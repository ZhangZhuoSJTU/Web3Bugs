// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXLPStaking.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./proxy/ClonesUpgradeable.sol";
import "./proxy/BeaconProxy.sol";
import "./proxy/UpgradeableBeacon.sol";
import "./util/PausableUpgradeable.sol";
import "./NFTXVaultUpgradeable.sol";

// TODO Look through all dependencies.

contract NFTXVaultFactoryUpgradeable is
    PausableUpgradeable,
    UpgradeableBeacon,
    INFTXVaultFactory
{
    uint256 public override numVaults;
    address public override prevContract;
    address public override feeReceiver;
    address public override eligibilityManager;

    mapping(uint256 => address) public override vault;
    mapping(address => address[]) public vaultsForAsset;
    address[] public allVaults;

    event NewFeeReceiver(address oldReceiver, address newReceiver);
    event NewVault(uint256 indexed vaultId, address vaultAddress, address assetAddress);

    function __NFTXVaultFactory_init(address _vaultImpl, address _prevContract, address _feeReceiver) public override initializer {
        __Pausable_init();
        // We use a beacon proxy so that every contract follows the same implementation code.
        __UpgradeableBeacon__init(_vaultImpl);
        prevContract = _prevContract;
        feeReceiver = _feeReceiver;
    }

    function createVault(
        string memory name,
        string memory symbol,
        address _assetAddress,
        bool is1155,
        bool allowAllItems
    ) public virtual override returns (uint256) {
        onlyOwnerIfPaused(0);
        require(feeReceiver != address(0), "NFTX: Fee receiver unset");
        require(implementation() != address(0), "NFTX: Vault implementation unset");
        address vaultAddr = deployVault(name, symbol, _assetAddress, is1155, allowAllItems);
        uint256 _vaultId = numVaults;
        vault[_vaultId] = vaultAddr;
        vaultsForAsset[_assetAddress].push(vaultAddr);
        allVaults.push(vaultAddr);
        numVaults += 1;
        INFTXFeeDistributor(feeReceiver).initializeVaultReceivers(_vaultId);
        emit NewVault(_vaultId, vaultAddr, _assetAddress);
        return _vaultId;
    }

    function setFeeReceiver(address _feeReceiver) public onlyOwner virtual override {
        require(_feeReceiver != address(0));
        emit NewFeeReceiver(feeReceiver, _feeReceiver);
        feeReceiver = _feeReceiver;
    }

    function deployVault(
        string memory name,
        string memory symbol,
        address _assetAddress,
        bool is1155,
        bool allowAllItems
    ) internal returns (address) {
        address newBeaconProxy = address(new BeaconProxy(address(this), ""));
        NFTXVaultUpgradeable(newBeaconProxy).__NFTXVault_init(name, symbol, _assetAddress, is1155, allowAllItems);
        // Manager for configuration.
        NFTXVaultUpgradeable(newBeaconProxy).setManager(msg.sender);
        // Owner for administrative functions.
        NFTXVaultUpgradeable(newBeaconProxy).transferOwnership(owner());
        return newBeaconProxy;
    }
}
