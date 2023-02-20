// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "./Vault.sol";

contract EthVault is Vault {
    using AddressProviderHelpers for IAddressProvider;

    address private constant _UNDERLYING = address(0);

    constructor(IController controller) Vault(controller) {}

    receive() external payable {}

    function initialize(
        address _pool,
        uint256 _debtLimit,
        uint256 _targetAllocation,
        uint256 _bound
    ) external virtual override initializer {
        _initialize(_pool, _debtLimit, _targetAllocation, _bound);
    }

    function getUnderlying() public pure override returns (address) {
        return _UNDERLYING;
    }

    function _transfer(address to, uint256 amount) internal override {
        payable(to).transfer(amount);
    }

    function _depositToReserve(uint256 amount) internal override {
        reserve.deposit{value: amount}(_UNDERLYING, amount);
    }

    function _depositToTreasury(uint256 amount) internal override {
        payable(addressProvider.getTreasury()).transfer(amount);
    }

    function _payStrategist(uint256 amount, address strategist) internal override {
        if (strategist == address(0)) return;
        ILiquidityPool(pool).depositFor{value: amount}(strategist, amount);
    }

    function _availableUnderlying() internal view override returns (uint256) {
        return address(this).balance;
    }
}
