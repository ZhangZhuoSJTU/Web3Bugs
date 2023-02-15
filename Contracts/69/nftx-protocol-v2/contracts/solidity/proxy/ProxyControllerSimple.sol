// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../util/Ownable.sol";
import "../interface/IAdminUpgradeabilityProxy.sol";

contract ProxyControllerSimple is Ownable {
    address public impl;

    IAdminUpgradeabilityProxy private proxy;

    event ImplAddressSet(address impl);
    event ProxyAdminChanged(address newAdmin);

    constructor(address _proxy) {
        proxy = IAdminUpgradeabilityProxy(_proxy);
    }

    function getAdmin() public view returns (address admin) {
        return proxy.admin();
    }

    function fetchImplAddress() public {
        impl = proxy.implementation();
        emit ImplAddressSet(impl);
    }

    function changeProxyAdmin(address newAdmin) public onlyOwner {
        proxy.changeAdmin(newAdmin);
        emit ProxyAdminChanged(newAdmin);
    }

    function upgradeProxyTo(address newImpl) public onlyOwner {
        proxy.upgradeTo(newImpl);
    }
}
