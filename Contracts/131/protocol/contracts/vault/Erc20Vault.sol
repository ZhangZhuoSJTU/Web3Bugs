// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./Vault.sol";

contract Erc20Vault is Vault {
    using AddressProviderHelpers for IAddressProvider;
    using SafeERC20 for IERC20;

    constructor(IController controller) Vault(controller) {}

    function initialize(
        address _pool,
        uint256 _debtLimit,
        uint256 _targetAllocation,
        uint256 _bound
    ) external virtual override initializer {
        _initialize(_pool, _debtLimit, _targetAllocation, _bound);
        address underlying_ = ILiquidityPool(pool).getUnderlying();
        require(underlying_ != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        IERC20(underlying_).safeApprove(address(reserve), type(uint256).max);
        IERC20(underlying_).safeApprove(_pool, type(uint256).max);
    }

    function getUnderlying() public view override returns (address) {
        return ILiquidityPool(pool).getUnderlying();
    }

    function _transfer(address to, uint256 amount) internal override {
        IERC20(getUnderlying()).safeTransfer(to, amount);
    }

    function _depositToReserve(uint256 amount) internal override {
        reserve.deposit(getUnderlying(), amount);
    }

    function _depositToRewardHandler(uint256 amount) internal override {
        address handler = addressProvider.getSafeRewardHandler();
        if (handler == address(0)) {
            handler = addressProvider.getTreasury();
        }
        IERC20(getUnderlying()).safeTransfer(handler, amount);
    }

    function _payStrategist(uint256 amount, address strategist) internal override {
        if (strategist == address(0)) return;
        ILiquidityPool(pool).depositFor(strategist, amount);
    }

    function _availableUnderlying() internal view override returns (uint256) {
        return IERC20(getUnderlying()).balanceOf(address(this));
    }
}
