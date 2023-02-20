// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXLPStaking.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./proxy/ClonesUpgradeable.sol";
import "./proxy/BeaconProxy.sol";
import "./proxy/UpgradeableBeacon.sol";
import "./util/PausableUpgradeable.sol";
import "./NFTXVaultUpgradeable.sol";

// Authors: @0xKiwi_ and @alexgausman.

contract NFTXVaultFactoryUpgradeable is
    PausableUpgradeable,
    UpgradeableBeacon,
    INFTXVaultFactory
{
    uint256 private NOT_USED1; // Removed, no longer needed.
    address public override zapContract;
    address public override feeDistributor;
    address public override eligibilityManager;

    mapping(uint256 => address) private NOT_USED2; // Removed, no longer needed.
    mapping(address => address[]) _vaultsForAsset;
    
    address[] internal vaults;

    // v1.0.1
    mapping(address => bool) public override excludedFromFees;

    // v1.0.2
    struct VaultFees {
        bool active;
        uint64 mintFee;
        uint64 randomRedeemFee;
        uint64 targetRedeemFee;
        uint64 randomSwapFee;
        uint64 targetSwapFee;
    }
    mapping(uint256 => VaultFees) private _vaultFees;
    uint64 public override factoryMintFee;
    uint64 public override factoryRandomRedeemFee;
    uint64 public override factoryTargetRedeemFee;
    uint64 public override factoryRandomSwapFee;
    uint64 public override factoryTargetSwapFee;

    function __NFTXVaultFactory_init(address _vaultImpl, address _feeDistributor) public override initializer {
        __Pausable_init();
        // We use a beacon proxy so that every child contract follows the same implementation code.
        __UpgradeableBeacon__init(_vaultImpl);
        setFeeDistributor(_feeDistributor);
        setFactoryFees(0.1 ether, 0.05 ether, 0.1 ether, 0.05 ether, 0.1 ether);
    }

    function assignFees() public {
        require(factoryMintFee == 0 && factoryTargetRedeemFee == 0, "Assigned");
        factoryMintFee = uint64(0.1 ether);
        factoryRandomRedeemFee = uint64(0.05 ether);
        factoryTargetRedeemFee = uint64(0.1 ether);
        factoryRandomSwapFee = uint64(0.05 ether);
        factoryTargetSwapFee = uint64(0.1 ether);

        emit UpdateFactoryFees(0.1 ether, 0.05 ether, 0.1 ether, 0.05 ether, 0.1 ether);
    }

    function createVault(
        string memory name,
        string memory symbol,
        address _assetAddress,
        bool is1155,
        bool allowAllItems
    ) external virtual override returns (uint256) {
        onlyOwnerIfPaused(0);
        require(feeDistributor != address(0), "NFTX: Fee receiver unset");
        require(childImplementation() != address(0), "NFTX: Vault implementation unset");
        address vaultAddr = deployVault(name, symbol, _assetAddress, is1155, allowAllItems);
        uint256 _vaultId = vaults.length;
        _vaultsForAsset[_assetAddress].push(vaultAddr);
        vaults.push(vaultAddr);
        INFTXFeeDistributor(feeDistributor).initializeVaultReceivers(_vaultId);
        emit NewVault(_vaultId, vaultAddr, _assetAddress);
        return _vaultId;
    }

    function setFactoryFees(
        uint256 mintFee, 
        uint256 randomRedeemFee, 
        uint256 targetRedeemFee,
        uint256 randomSwapFee, 
        uint256 targetSwapFee
    ) public onlyOwner virtual override {
        require(mintFee <= 1 ether, "Cannot > 1 ether");
        require(randomRedeemFee <= 1 ether, "Cannot > 1 ether");
        require(targetRedeemFee <= 1 ether, "Cannot > 1 ether");
        require(randomSwapFee <= 1 ether, "Cannot > 1 ether");
        require(targetSwapFee <= 1 ether, "Cannot > 1 ether");

        factoryMintFee = uint64(mintFee);
        factoryRandomRedeemFee = uint64(randomRedeemFee);
        factoryTargetRedeemFee = uint64(targetRedeemFee);
        factoryRandomSwapFee = uint64(randomSwapFee);
        factoryTargetSwapFee = uint64(targetSwapFee);

        emit UpdateFactoryFees(mintFee, randomRedeemFee, targetRedeemFee, randomSwapFee, targetSwapFee);
    }

    function setVaultFees(
        uint256 vaultId, 
        uint256 mintFee, 
        uint256 randomRedeemFee, 
        uint256 targetRedeemFee,
        uint256 randomSwapFee, 
        uint256 targetSwapFee
    ) public virtual override {
        if (msg.sender != owner()) {
            address vaultAddr = vaults[vaultId];
            require(msg.sender == vaultAddr, "Not from vault");
        }
        require(mintFee <= 1 ether, "Cannot > 1 ether");
        require(randomRedeemFee <= 1 ether, "Cannot > 1 ether");
        require(targetRedeemFee <= 1 ether, "Cannot > 1 ether");
        require(randomSwapFee <= 1 ether, "Cannot > 1 ether");
        require(targetSwapFee <= 1 ether, "Cannot > 1 ether");

        _vaultFees[vaultId] = VaultFees(
            true, 
            uint64(mintFee),
            uint64(randomRedeemFee),
            uint64(targetRedeemFee),
            uint64(randomSwapFee), 
            uint64(targetSwapFee)
        );
        emit UpdateVaultFees(vaultId, mintFee, randomRedeemFee, targetRedeemFee, randomSwapFee, targetSwapFee);
    }

    function disableVaultFees(uint256 vaultId) public virtual override {
        if (msg.sender != owner()) {
            address vaultAddr = vaults[vaultId];
            require(msg.sender == vaultAddr, "Not vault");
        }
        delete _vaultFees[vaultId];
        emit DisableVaultFees(vaultId);
    }

    function setFeeDistributor(address _feeDistributor) public onlyOwner virtual override {
        require(_feeDistributor != address(0));
        emit NewFeeDistributor(feeDistributor, _feeDistributor);
        feeDistributor = _feeDistributor;
    }

    function setZapContract(address _zapContract) public onlyOwner virtual override {
        emit NewZapContract(zapContract, _zapContract);
        zapContract = _zapContract;
    }

    function setFeeExclusion(address _excludedAddr, bool excluded) public onlyOwner virtual override {
        emit FeeExclusion(_excludedAddr, excluded);
        excludedFromFees[_excludedAddr] = excluded;
    }

    function setEligibilityManager(address _eligibilityManager) external onlyOwner virtual override {
        emit NewEligibilityManager(eligibilityManager, _eligibilityManager);
        eligibilityManager = _eligibilityManager;
    }

    function vaultFees(uint256 vaultId) external view virtual override returns (uint256, uint256, uint256, uint256, uint256) {
        VaultFees memory fees = _vaultFees[vaultId];
        if (fees.active) {
            return (
                uint256(fees.mintFee), 
                uint256(fees.randomRedeemFee), 
                uint256(fees.targetRedeemFee), 
                uint256(fees.randomSwapFee), 
                uint256(fees.targetSwapFee)
            );
        }
        
        return (uint256(factoryMintFee), uint256(factoryRandomRedeemFee), uint256(factoryTargetRedeemFee), uint256(factoryRandomSwapFee), uint256(factoryTargetSwapFee));
    }

    function isLocked(uint256 lockId) external view override virtual returns (bool) {
        return isPaused[lockId];
    }

    function vaultsForAsset(address assetAddress) external view override virtual returns (address[] memory) {
        return _vaultsForAsset[assetAddress];
    }

    function vault(uint256 vaultId) external view override virtual returns (address) {
        return vaults[vaultId];
    }

    function allVaults() external view override virtual returns (address[] memory) {
        return vaults;
    }

    function numVaults() external view override virtual returns (uint256) {
        return vaults.length;
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
