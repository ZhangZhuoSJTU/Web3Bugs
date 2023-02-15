// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../util/Ownable.sol";
import "../interface/IAdminUpgradeabilityProxy.sol";

contract ProxyController is Ownable {
    address public vaultFactoryImpl;
    address public eligManagerImpl;
    address public stakingProviderImpl;
    address public stakingImpl;
    address public feeDistribImpl;

    IAdminUpgradeabilityProxy private vaultFactoryProxy;
    IAdminUpgradeabilityProxy private eligManagerProxy;
    IAdminUpgradeabilityProxy private stakingProviderProxy;
    IAdminUpgradeabilityProxy private stakingProxy;
    IAdminUpgradeabilityProxy private feeDistribProxy;

    event ImplAddressSet(uint256 index, address impl);
    event ProxyAdminChanged(uint256 index, address newAdmin);

    constructor(
        address vaultFactory,
        address eligManager,
        address stakingProvider,
        address staking,
        address feeDistrib
    ) {
        vaultFactoryProxy = IAdminUpgradeabilityProxy(vaultFactory);
        eligManagerProxy = IAdminUpgradeabilityProxy(eligManager);
        stakingProviderProxy = IAdminUpgradeabilityProxy(stakingProvider);
        stakingProxy = IAdminUpgradeabilityProxy(staking);
        feeDistribProxy = IAdminUpgradeabilityProxy(feeDistrib);
    }

    function getAdmin(uint256 index) public view returns (address admin) {
        if (index == 0) {
            return vaultFactoryProxy.admin();
        } else if (index == 1) {
            return eligManagerProxy.admin();
        } else if (index == 2) {
            return stakingProviderProxy.admin();
        } else if (index == 3) {
            return stakingProxy.admin();
        } else if (index == 4) {
            return feeDistribProxy.admin();
        }
    }

    function fetchImplAddress(uint256 index) public {
        if (index == 0) {
            vaultFactoryImpl = vaultFactoryProxy.implementation();
            emit ImplAddressSet(0, vaultFactoryImpl);
        } else if (index == 1) {
            eligManagerImpl = eligManagerProxy.implementation();
            emit ImplAddressSet(index, eligManagerImpl);
        } else if (index == 2) {
            stakingProviderImpl = stakingProviderProxy.implementation();
            emit ImplAddressSet(index, stakingProviderImpl);
        } else if (index == 3) {
            stakingImpl = stakingProxy.implementation();
            emit ImplAddressSet(index, stakingImpl);
        } else if (index == 4) {
            feeDistribImpl = feeDistribProxy.implementation();
            emit ImplAddressSet(index, feeDistribImpl);
        }
    }

    function changeAllProxyAdmins(address newAdmin) public onlyOwner {
        changeProxyAdmin(0, newAdmin);
        changeProxyAdmin(1, newAdmin);
        changeProxyAdmin(2, newAdmin);
        changeProxyAdmin(3, newAdmin);
        changeProxyAdmin(4, newAdmin);
    }

    function changeProxyAdmin(uint256 index, address newAdmin)
        public
        onlyOwner
    {
        if (index == 0) {
            vaultFactoryProxy.changeAdmin(newAdmin);
        } else if (index == 1) {
            eligManagerProxy.changeAdmin(newAdmin);
        } else if (index == 2) {
            stakingProviderProxy.changeAdmin(newAdmin);
        } else if (index == 3) {
            stakingProxy.changeAdmin(newAdmin);
        } else if (index == 4) {
            feeDistribProxy.changeAdmin(newAdmin);
        }
        emit ProxyAdminChanged(index, newAdmin);
    }

    function upgradeProxyTo(uint256 index, address newImpl) public onlyOwner {
        if (index == 0) {
            vaultFactoryProxy.upgradeTo(newImpl);
        } else if (index == 1) {
            eligManagerProxy.upgradeTo(newImpl);
        } else if (index == 2) {
            stakingProviderProxy.upgradeTo(newImpl);
        } else if (index == 3) {
            stakingProxy.upgradeTo(newImpl);
        } else if (index == 4) {
            feeDistribProxy.upgradeTo(newImpl);
        }
    }
}
