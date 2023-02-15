// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./LiquidityPool.sol";
import "../../interfaces/pool/IErc20Pool.sol";

contract Erc20Pool is LiquidityPool, IErc20Pool {
    using SafeERC20 for IERC20;

    address private _underlying;

    constructor(IController _controller) LiquidityPool(_controller) {}

    function initialize(
        string calldata name_,
        address underlying_,
        address vault_
    ) public override returns (bool) {
        require(underlying_ != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        _underlying = underlying_;
        return _initialize(name_, vault_);
    }

    function getUnderlying() public view override returns (address) {
        return _underlying;
    }

    function _doTransferIn(address from, uint256 amount) internal override {
        require(msg.value == 0, Error.INVALID_VALUE);
        IERC20(_underlying).safeTransferFrom(from, address(this), amount);
    }

    function _doTransferOut(address payable to, uint256 amount) internal override {
        IERC20(_underlying).safeTransfer(to, amount);
    }

    function _getBalanceUnderlying() internal view override returns (uint256) {
        return IERC20(_underlying).balanceOf(address(this));
    }

    function _getBalanceUnderlying(bool) internal view override returns (uint256) {
        return _getBalanceUnderlying();
    }
}
