// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {FixedStablecoins} from "contracts/common/FixedContracts.sol";
import {ICurve3Pool} from "contracts/interfaces/ICurve.sol";

import "contracts/common/Controllable.sol";

import "contracts/interfaces/IBuoy.sol";
import "contracts/interfaces/IChainPrice.sol";
import "contracts/interfaces/IChainlinkAggregator.sol";
import "contracts/interfaces/IERC20Detailed.sol";

/// @notice Contract for calculating prices of underlying assets and LP tokens in Curve pool. Also
///     used to sanity check pool against external oracle, to ensure that pools underlying coin ratios
///     are within a specific range (measued in BP) of the external oracles coin price ratios.
///     Sanity check:
///         The Buoy checks previously recorded (cached) curve coin dy, which it compares against current curve dy,
///         blocking any interaction that is outside a certain tolerance (BASIS_POINTS). When updting the cached
///         value, the buoy uses chainlink to ensure that curves prices arent off peg.
contract Buoy3Pool is FixedStablecoins, Controllable, IBuoy, IChainPrice {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 TIME_LIMIT = 3000;
    uint256 public BASIS_POINTS = 20;
    uint256 constant CHAIN_FACTOR = 100;

    ICurve3Pool public immutable override curvePool;
    IERC20 public immutable lpToken;

    mapping(uint256 => uint256) lastRatio;

    // Chianlink price feed
    address public immutable daiUsdAgg;
    address public immutable usdcUsdAgg;
    address public immutable usdtUsdAgg;

    mapping(address => mapping(address => uint256)) public tokenRatios;

    event LogNewBasisPointLimit(uint256 oldLimit, uint256 newLimit);

    constructor(
        address _crv3pool,
        address poolToken,
        address[N_COINS] memory _tokens,
        uint256[N_COINS] memory _decimals,
        address[N_COINS] memory aggregators
    ) public FixedStablecoins(_tokens, _decimals) {
        curvePool = ICurve3Pool(_crv3pool);
        lpToken = IERC20(poolToken);
        daiUsdAgg = aggregators[0];
        usdcUsdAgg = aggregators[1];
        usdtUsdAgg = aggregators[2];
    }

    /// @notice Set limit for how much Curve pool and external oracle is allowed
    ///     to deviate before failing transactions
    /// @param newLimit New limit in BP
    function setBasisPointsLmit(uint256 newLimit) external onlyOwner {
        uint256 oldLimit = BASIS_POINTS;
        BASIS_POINTS = newLimit;
        emit LogNewBasisPointLimit(oldLimit, newLimit);
    }

    /// @notice Check the health of the Curve pool:
    ///     Ratios are checked by the following heuristic:
    ///     Orcale A - Curve
    ///     Oracle B - External oracle
    ///     Both oracles establish ratios for a set of stable coins
    ///         (a, b, c)
    ///     and product the following set of ratios:
    ///         (a/a, a/b, a/c), (b/b, b/a, b/c), (c/c, c/a, c/b)
    ///     It's simply to reduce the number of comparisons to be made
    ///     in order to have complete coverage of the system ratios:
    ///         1) ratios between a stable coin and itself can be discarded
    ///         2) inverted ratios, a/b bs b/a, while producing different results
    ///             should both reflect the same change in any one of the two
    ///             underlying assets, but in opposite directions
    ///     This mean that the following set should provide the necessary coverage checks
    ///     to establish that the coins pricing is healthy:
    ///         (a/b, a/c)
    function safetyCheck() external view override returns (bool) {
        for (uint256 i = 1; i < N_COINS; i++) {
            uint256 _ratio = curvePool.get_dy(int128(0), int128(i), getDecimal(0));
            _ratio = abs(int256(_ratio - lastRatio[i]));
            if (_ratio.mul(PERCENTAGE_DECIMAL_FACTOR).div(CURVE_RATIO_DECIMALS_FACTOR) > BASIS_POINTS) {
                return false;
            }
        }
        return true;
    }

    /// @notice Updated cached curve value with a custom tolerance towards chainlink
    /// @param tolerance How much difference between curve and chainlink can be tolerated
    function updateRatiosWithTolerance(uint256 tolerance) external override returns (bool) {
        require(msg.sender == controller || msg.sender == owner(), "updateRatiosWithTolerance: !authorized");
        return _updateRatios(tolerance);
    }

    /// @notice Updated cached curve values
    function updateRatios() external override returns (bool) {
        require(msg.sender == controller || msg.sender == owner(), "updateRatios: !authorized");
        return _updateRatios(BASIS_POINTS);
    }

    /// @notice Get USD value for a specific input amount of tokens, slippage included
    function stableToUsd(uint256[N_COINS] calldata inAmounts, bool deposit) external view override returns (uint256) {
        return _stableToUsd(inAmounts, deposit);
    }

    /// @notice Get estimate USD price of a stablecoin amount
    /// @param inAmount Token amount
    /// @param i Index of token
    function singleStableToUsd(uint256 inAmount, uint256 i) external view override returns (uint256) {
        uint256[N_COINS] memory inAmounts;
        inAmounts[i] = inAmount;
        return _stableToUsd(inAmounts, true);
    }

    /// @notice Get LP token value of input amount of tokens
    function stableToLp(uint256[N_COINS] calldata tokenAmounts, bool deposit) external view override returns (uint256) {
        return _stableToLp(tokenAmounts, deposit);
    }

    /// @notice Get LP token value of input amount of single token
    function singleStableFromUsd(uint256 inAmount, int128 i) external view override returns (uint256) {
        return _singleStableFromLp(_usdToLp(inAmount), i);
    }

    /// @notice Get LP token value of input amount of single token
    function singleStableFromLp(uint256 inAmount, int128 i) external view override returns (uint256) {
        return _singleStableFromLp(inAmount, i);
    }

    /// @notice Get USD price of LP tokens you receive for a specific input amount of tokens, slippage included
    function lpToUsd(uint256 inAmount) external view override returns (uint256) {
        return _lpToUsd(inAmount);
    }

    /// @notice Convert USD amount to LP tokens
    function usdToLp(uint256 inAmount) external view override returns (uint256) {
        return _usdToLp(inAmount);
    }

    /// @notice Split LP token amount to balance of pool tokens
    /// @param inAmount Amount of LP tokens
    /// @param totalBalance Total balance of pool
    function poolBalances(uint256 inAmount, uint256 totalBalance)
        internal
        view
        returns (uint256[N_COINS] memory balances)
    {
        uint256[N_COINS] memory _balances;
        for (uint256 i = 0; i < N_COINS; i++) {
            _balances[i] = (IERC20(getToken(i)).balanceOf(address(curvePool)).mul(inAmount)).div(totalBalance);
        }
        balances = _balances;
    }

    function getVirtualPrice() external view override returns (uint256) {
        return curvePool.get_virtual_price();
    }

    // Internal functions
    function _lpToUsd(uint256 inAmount) internal view returns (uint256) {
        return inAmount.mul(curvePool.get_virtual_price()).div(DEFAULT_DECIMALS_FACTOR);
    }

    function _stableToUsd(uint256[N_COINS] memory tokenAmounts, bool deposit) internal view returns (uint256) {
        require(tokenAmounts.length == N_COINS, "deposit: !length");
        uint256[N_COINS] memory _tokenAmounts;
        for (uint256 i = 0; i < N_COINS; i++) {
            _tokenAmounts[i] = tokenAmounts[i];
        }
        uint256 lpAmount = curvePool.calc_token_amount(_tokenAmounts, deposit);
        return _lpToUsd(lpAmount);
    }

    function _stableToLp(uint256[N_COINS] memory tokenAmounts, bool deposit) internal view returns (uint256) {
        require(tokenAmounts.length == N_COINS, "deposit: !length");
        uint256[N_COINS] memory _tokenAmounts;
        for (uint256 i = 0; i < N_COINS; i++) {
            _tokenAmounts[i] = tokenAmounts[i];
        }
        return curvePool.calc_token_amount(_tokenAmounts, deposit);
    }

    function _singleStableFromLp(uint256 inAmount, int128 i) internal view returns (uint256) {
        uint256 result = curvePool.calc_withdraw_one_coin(inAmount, i);
        return result;
    }

    /// @notice Convert USD amount to LP tokens
    function _usdToLp(uint256 inAmount) internal view returns (uint256) {
        return inAmount.mul(DEFAULT_DECIMALS_FACTOR).div(curvePool.get_virtual_price());
    }

    /// @notice Calculate price ratios for stablecoins
    ///     Get USD price data for stablecoin
    /// @param i Stablecoin to get USD price for
    function getPriceFeed(uint256 i) external view override returns (uint256 _price) {
        _price = uint256(IChainlinkAggregator(getAggregator(i)).latestAnswer());
    }

    /// @notice Fetch chainlink token ratios
    /// @param i Token in
    function getTokenRatios(uint256 i) private view returns (uint256[3] memory _ratios) {
        uint256[3] memory _prices;
        _prices[0] = uint256(IChainlinkAggregator(getAggregator(0)).latestAnswer());
        _prices[1] = uint256(IChainlinkAggregator(getAggregator(1)).latestAnswer());
        _prices[2] = uint256(IChainlinkAggregator(getAggregator(2)).latestAnswer());
        for (uint256 j = 0; j < 3; j++) {
            if (i == j) {
                _ratios[i] = CHAINLINK_PRICE_DECIMAL_FACTOR;
            } else {
                _ratios[j] = _prices[i].mul(CHAINLINK_PRICE_DECIMAL_FACTOR).div(_prices[j]);
            }
        }
        return _ratios;
    }

    function getAggregator(uint256 index) private view returns (address) {
        if (index == 0) {
            return daiUsdAgg;
        } else if (index == 1) {
            return usdcUsdAgg;
        } else {
            return usdtUsdAgg;
        }
    }

    /// @notice Get absolute value
    function abs(int256 x) private pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    function _updateRatios(uint256 tolerance) private returns (bool) {
        uint256[N_COINS] memory chainRatios = getTokenRatios(0);
        uint256[N_COINS] memory newRatios;
        for (uint256 i = 1; i < N_COINS; i++) {
            uint256 _ratio = curvePool.get_dy(int128(0), int128(i), getDecimal(0));
            uint256 check = abs(int256(_ratio) - int256(chainRatios[i].div(CHAIN_FACTOR)));
            if (check.mul(PERCENTAGE_DECIMAL_FACTOR).div(CURVE_RATIO_DECIMALS_FACTOR) > tolerance) {
                return false;
            } else {
                newRatios[i] = _ratio;
            }
        }
        for (uint256 i = 1; i < N_COINS; i++) {
            lastRatio[i] = newRatios[i];
        }
        return true;
    }
}
