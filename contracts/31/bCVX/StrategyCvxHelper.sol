// SPDX-License-Identifier: MIT

pragma solidity ^0.6.11;
pragma experimental ABIEncoderV2;

import "deps/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "deps/@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "deps/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "deps/@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "deps/@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";

import "interfaces/convex/IBooster.sol";
import "interfaces/convex/CrvDepositor.sol";
import "interfaces/convex/IBaseRewardsPool.sol";
import "interfaces/convex/ICvxRewardsPool.sol";

import "../../libraries/CurveSwapper.sol";
import "../../libraries/UniswapSwapper.sol";
import "../../libraries/TokenSwapPathRegistry.sol";

import "../BaseStrategy.sol";

/*
    1. Stake cvxCrv
    2. Sell earned rewards into cvxCrv position and restake
*/
contract StrategyCvxHelper is BaseStrategy, CurveSwapper, UniswapSwapper, TokenSwapPathRegistry {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // ===== Token Registry =====
    address public constant wbtc = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address public constant weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant crv = 0xD533a949740bb3306d119CC777fa900bA034cd52;
    address public constant cvx = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;
    address public constant cvxCrv = 0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7;
    address public constant usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant threeCrv = 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490;

    IERC20Upgradeable public constant crvToken = IERC20Upgradeable(0xD533a949740bb3306d119CC777fa900bA034cd52);
    IERC20Upgradeable public constant cvxToken = IERC20Upgradeable(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    IERC20Upgradeable public constant cvxCrvToken = IERC20Upgradeable(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    IERC20Upgradeable public constant usdcToken = IERC20Upgradeable(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20Upgradeable public constant threeCrvToken = IERC20Upgradeable(0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490);

    // ===== Convex Registry =====
    CrvDepositor public constant crvDepositor = CrvDepositor(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae); // Convert CRV -> cvxCRV/ETH SLP
    IBooster public constant booster = IBooster(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    ICvxRewardsPool public constant cvxRewardsPool = ICvxRewardsPool(0xCF50b810E57Ac33B91dCF525C6ddd9881B139332);
    IBaseRewardsPool public constant cvxCrvRewardsPool = IBaseRewardsPool(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
    uint256 public constant MAX_UINT_256 = uint256(-1);

    event HarvestState(uint256 timestamp, uint256 blockNumber);

    event WithdrawState(uint256 toWithdraw, uint256 preWant, uint256 postWant, uint256 withdrawn);

    struct TokenSwapData {
        address tokenIn;
        uint256 totalSold;
        uint256 wantGained;
    }

    event TendState(uint256 crvTended, uint256 cvxTended, uint256 cvxCrvHarvested);

    function initialize(
        address _governance,
        address _strategist,
        address _controller,
        address _keeper,
        address _guardian,
        uint256[3] memory _feeConfig
    ) public initializer whenNotPaused {
        __BaseStrategy_init(_governance, _strategist, _controller, _keeper, _guardian);

        want = cvx;

        performanceFeeGovernance = _feeConfig[0];
        performanceFeeStrategist = _feeConfig[1];
        withdrawalFee = _feeConfig[2];

        address[] memory path = new address[](3);
        path[0] = cvxCrv;
        path[1] = weth;
        path[2] = cvx;
        _setTokenSwapPath(cvxCrv, cvx, path);

        // Approvals: Staking Pool
        cvxToken.approve(address(cvxRewardsPool), MAX_UINT_256);
    }

    /// ===== View Functions =====
    function version() external pure returns (string memory) {
        return "1.0";
    }

    function getName() external override pure returns (string memory) {
        return "StrategyCvxHelper";
    }

    function balanceOfPool() public override view returns (uint256) {
        return cvxRewardsPool.balanceOf(address(this));
    }

    function getProtectedTokens() public override view returns (address[] memory) {
        address[] memory protectedTokens = new address[](2);
        protectedTokens[0] = want;
        protectedTokens[1] = cvx;
        return protectedTokens;
    }

    function isTendable() public override view returns (bool) {
        return false;
    }
    
    /// ===== Internal Core Implementations =====
    function _onlyNotProtectedTokens(address _asset) internal override {
        require(!isProtectedToken(_asset));
    }

    /// @dev Deposit Badger into the staking contract
    function _deposit(uint256 _want) internal override {
        // Deposit all want in core staking pool
        cvxRewardsPool.stake(_want);
    }

    /// @dev Unroll from all strategy positions, and transfer non-core tokens to controller rewards
    function _withdrawAll() internal override {
        // TODO: Functionality not required for initial migration
        // Note: All want is automatically withdrawn outside this "inner hook" in base strategy function
    }

    /// @dev Withdraw want from staking rewards, using earnings first
    function _withdrawSome(uint256 _amount) internal override returns (uint256) {
        // Get idle want in the strategy
        uint256 _preWant = IERC20Upgradeable(want).balanceOf(address(this));

        // If we lack sufficient idle want, withdraw the difference from the strategy position
        if (_preWant < _amount) {
            uint256 _toWithdraw = _amount.sub(_preWant);
            cvxRewardsPool.withdraw(_toWithdraw, false);

            // Note: Withdrawl process will earn sushi, this will be deposited into SushiBar on next tend()
        }

        // Confirm how much want we actually end up with
        uint256 _postWant = IERC20Upgradeable(want).balanceOf(address(this));

        // Return the actual amount withdrawn if less than requested
        uint256 _withdrawn = MathUpgradeable.min(_postWant, _amount);
        emit WithdrawState(_amount, _preWant, _postWant, _withdrawn);

        return _withdrawn;
    }

    function _tendGainsFromPositions() internal {
        if (cvxRewardsPool.earned(address(this)) > 0) {
            cvxRewardsPool.getReward(false);
        }
    }   

    function patchPaths() external {
        _onlyGovernance();
        address[] memory path = new address[](4);
        path[0] = cvx;
        path[1] = weth;
        path[2] = crv;
        path[3] = cvxCrv;
        _setTokenSwapPath(cvx, cvxCrv, path);

        path = new address[](4);
        path[0] = usdc;
        path[1] = weth;
        path[2] = crv;
        path[3] = cvxCrv;
        _setTokenSwapPath(usdc, cvxCrv, path);
    }

    function harvest() external whenNotPaused returns (uint256 cvxHarvested) {
        _onlyAuthorizedActors();
        // 1. Harvest gains from positions
        _tendGainsFromPositions();

        uint256 stakedCvxCrv = cvxCrvRewardsPool.balanceOf(address(this));
        if (stakedCvxCrv > 0) {
            cvxCrvRewardsPool.withdraw(stakedCvxCrv, true);
        }
        
        // 2. Swap cvxCRV tokens to CVX
        uint256 cvxCrvBalance = cvxCrvToken.balanceOf(address(this));

        if (cvxCrvBalance > 0) {
            _swapExactTokensForTokens(sushiswap, cvxCrv, cvxCrvBalance, getTokenSwapPath(cvxCrv, cvx));
        }

        // Track harvested + converted coin balance of want
        cvxHarvested = cvxToken.balanceOf(address(this));
        _processFee(cvx, cvxHarvested, performanceFeeGovernance, IController(controller).rewards());

        // 3. Stake all CVX
        if (cvxHarvested > 0) {
            cvxRewardsPool.stake(cvxToken.balanceOf(address(this)));
        }

        emit Harvest(cvxHarvested, block.number);
        return cvxHarvested;
    }
}