// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../../interfaces/vendor/ICurveSwap.sol";
import "../../libraries/UncheckedMath.sol";
import "./MockCurveToken.sol";

/**
 * @notice This is a just a mock contract and does NOT contain the logic for a Curve StableSwap pool.
 */

contract MockStableSwap is ICurveSwap {
    using SafeCast for uint256;
    using UncheckedMath for uint256;
    using SafeCast for int128;

    uint256 private _virtualPrice = 1e18;
    uint256[3] private _balances = [0, 0, 0];
    address[3] private _allCoins;
    address private _lpToken;

    constructor(address[3] memory _coins, address lpToken_) {
        _allCoins = _coins;
        _lpToken = lpToken_;
    }

    // solhint-disable-next-line no-unused-vars, func-name-mixedcase
    function add_liquidity(uint256[3] calldata amounts, uint256) external override {
        uint256 total;
        for (uint256 i; i < 3; i = i.uncheckedInc()) {
            _balances[i] += amounts[i];
            total += amounts[i];
            IERC20(_allCoins[i]).transferFrom(msg.sender, address(this), amounts[i]);
        }
        // assume we mint 1 LP token per 1 underlying
        MockCurveToken(_lpToken).mintFor(msg.sender, total);
    }

    // solhint-disable-next-line no-unused-vars, func-name-mixedcase
    function add_liquidity(uint256[2] calldata amounts, uint256) external override {
        uint256 total;
        for (uint256 i; i < 2; i = i.uncheckedInc()) {
            _balances[i] += amounts[i];
            total += amounts[i];
            IERC20(_allCoins[i]).transferFrom(msg.sender, address(this), amounts[i]);
        }
        // assume we mint 1 LP token per 1 underlying
        MockCurveToken(_lpToken).mintFor(msg.sender, total);
    }

    // solhint-disable-next-line func-name-mixedcase
    function remove_liquidity_imbalance(uint256[3] calldata amounts, uint256 maxBurnAmount)
        external
        override
    {}

    // solhint-disable-next-line func-name-mixedcase
    function remove_liquidity_imbalance(uint256[2] calldata amounts, uint256 maxBurnAmount)
        external
        override
    {}

    /**
     * @param _amount LP tokens to burn
     * @param minAmounts Minimum amount of each underlying coin to withdraw
     */
    // solhint-disable-next-line func-name-mixedcase
    function remove_liquidity(uint256 _amount, uint256[3] calldata minAmounts) external override {
        // for mock; just withdraw minAmounts
        for (uint256 i; i < 3; i = i.uncheckedInc()) {
            _balances[i] -= minAmounts[i];
            IERC20(_allCoins[i]).transfer(msg.sender, minAmounts[i]);
        }
        MockCurveToken(_lpToken).burnFrom(msg.sender, _amount);
    }

    // solhint-disable-next-line func-name-mixedcase
    function remove_liquidity_one_coin(
        uint256 tokenAmount,
        int128 i,
        uint256 minAmount
    ) external override {
        require(_balances[i.toUint256()] >= minAmount, "Insufficient liquidity in mock curve pool");
        _balances[i.toUint256()] -= minAmount;
        IERC20(_allCoins[i.toUint256()]).transfer(msg.sender, minAmount);
        MockCurveToken(_lpToken).burnFrom(msg.sender, tokenAmount);
    }

    function exchange(
        int128 from,
        int128 to,
        uint256 fromAmount,
        uint256 minToAmount
    ) external override {}

    // solhint-disable-next-line func-name-mixedcase
    function get_balances() external view returns (uint256[3] memory) {
        return _balances;
    }

    // solhint-disable-next-line func-name-mixedcase
    function calc_token_amount(uint256[3] calldata amounts, bool deposit)
        external
        view
        override
        returns (uint256)
    {}

    // solhint-disable-next-line func-name-mixedcase
    function get_virtual_price() external view override returns (uint256) {
        return _virtualPrice;
    }

    function coins(uint256 index) external view override returns (address) {
        require(index >= 0 && index < 3, "Invalid coin index");
        return _allCoins[index];
    }

    // solhint-disable-next-line no-unused-vars, func-name-mixedcase
    function calc_withdraw_one_coin(uint256 tokenAmount, int128)
        external
        pure
        override
        returns (uint256)
    {
        // return amount assuming that 1 LP = 1 underlying
        return tokenAmount;
    }

    // solhint-disable-next-line func-name-mixedcase
    function get_dy(
        int128,
        int128,
        uint256
    ) external pure override returns (uint256) {
        return 10;
    }

    // solhint-disable-next-line func-name-mixedcase
    function calc_token_amount(uint256[2] calldata amounts, bool deposit)
        external
        pure
        override
        returns (uint256)
    {}

    // solhint-disable-next-line func-name-mixedcase
    function calc_token_amount(uint256[4] calldata amounts, bool deposit)
        external
        pure
        override
        returns (uint256)
    {}
}
