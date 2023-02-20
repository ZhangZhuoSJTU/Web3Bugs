// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IVaultFactory.sol";
import "./interfaces/IVaultRegistry.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice This contract is used to manage ERC721 NFT for all Vaults.
contract VaultRegistry is IVaultRegistry, ERC721 {
    uint256 private _stagedProtocolGovernanceTimestamp;
    IProtocolGovernance private _protocolGovernance;
    IProtocolGovernance private _stagedProtocolGovernance;

    address[] private _vaults;
    mapping(address => uint256) private _nftIndex;
    mapping(uint256 => address) private _vaultIndex;
    mapping(uint256 => bool) private _locks;
    uint256 private _topNft = 1;

    /// @notice Creates a new contract.
    /// @param name ERC721 token name
    /// @param symbol ERC721 token symbol
    /// @param protocolGovernance_ Reference to ProtocolGovernance
    constructor(
        string memory name,
        string memory symbol,
        IProtocolGovernance protocolGovernance_
    ) ERC721(name, symbol) {
        _protocolGovernance = protocolGovernance_;
    }

    function vaults() external view returns (address[] memory) {
        return _vaults;
    }

    /// @inheritdoc IVaultRegistry
    function vaultForNft(uint256 nft) external view returns (address) {
        return _vaultIndex[nft];
    }

    /// @inheritdoc IVaultRegistry
    function nftForVault(address vault) external view returns (uint256) {
        return _nftIndex[vault];
    }

    /// @inheritdoc IVaultRegistry
    function isLocked(uint256 nft) external view returns (bool) {
        return _locks[nft];
    }

    /// @inheritdoc IVaultRegistry
    function registerVault(address vault, address owner) external returns (uint256 nft) {
        require(_protocolGovernance.isVaultGovernance(msg.sender), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        nft = _topNft;
        _safeMint(owner, nft);
        _vaultIndex[nft] = vault;
        _nftIndex[vault] = nft;
        _vaults.push(vault);
        _topNft += 1;
        emit VaultRegistered(tx.origin, msg.sender, nft, vault, owner);
    }

    /// @inheritdoc IVaultRegistry
    function protocolGovernance() external view returns (IProtocolGovernance) {
        return _protocolGovernance;
    }

    /// @inheritdoc IVaultRegistry
    function stagedProtocolGovernance() external view returns (IProtocolGovernance) {
        return _stagedProtocolGovernance;
    }

    /// @inheritdoc IVaultRegistry
    function stagedProtocolGovernanceTimestamp() external view returns (uint256) {
        return _stagedProtocolGovernanceTimestamp;
    }

    /// @inheritdoc IVaultRegistry
    function vaultsCount() external view returns (uint256) {
        return _vaults.length;
    }

    /// @inheritdoc IVaultRegistry
    function stageProtocolGovernance(IProtocolGovernance newProtocolGovernance) external {
        require(_isProtocolAdmin(_msgSender()), ExceptionsLibrary.ADMIN);
        _stagedProtocolGovernance = newProtocolGovernance;
        _stagedProtocolGovernanceTimestamp = (block.timestamp + _protocolGovernance.governanceDelay());
        emit StagedProtocolGovernance(tx.origin, msg.sender, newProtocolGovernance, _stagedProtocolGovernanceTimestamp);
    }

    /// @inheritdoc IVaultRegistry
    function commitStagedProtocolGovernance() external {
        require(_isProtocolAdmin(_msgSender()), ExceptionsLibrary.ADMIN);
        require(_stagedProtocolGovernanceTimestamp > 0, ExceptionsLibrary.NULL_OR_NOT_INITIALIZED);
        require(block.timestamp >= _stagedProtocolGovernanceTimestamp, ExceptionsLibrary.TIMESTAMP);
        _protocolGovernance = _stagedProtocolGovernance;
        delete _stagedProtocolGovernanceTimestamp;
        emit CommitedProtocolGovernance(tx.origin, msg.sender, _protocolGovernance);
    }

    /// @inheritdoc IVaultRegistry
    function adminApprove(address newAddress, uint256 nft) external {
        require(_isProtocolAdmin(_msgSender()), ExceptionsLibrary.ADMIN);
        IERC721(address(this)).approve(newAddress, nft);
    }

    function lockNft(uint256 nft) external {
        require(ownerOf(nft) == msg.sender, ExceptionsLibrary.TOKEN_OWNER);
        _locks[nft] = true;
        emit TokenLocked(tx.origin, msg.sender, nft);
    }

    function _isProtocolAdmin(address sender) internal view returns (bool) {
        return _protocolGovernance.isAdmin(sender);
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256 tokenId
    ) internal view override {
        require(!_locks[tokenId], ExceptionsLibrary.LOCKED_NFT);
    }

    /// @notice Emitted when token is locked for transfers
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft NFT to be locked
    event TokenLocked(address indexed origin, address indexed sender, uint256 indexed nft);

    /// @notice Emitted when new Vault is registered in VaultRegistry
    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param nft VaultRegistry NFT of the vault
    /// @param vault Address of the Vault contract
    /// @param owner Owner of the VaultRegistry NFT
    event VaultRegistered(
        address indexed origin,
        address indexed sender,
        uint256 indexed nft,
        address vault,
        address owner
    );

    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param newProtocolGovernance Address of the new ProtocolGovernance
    /// @param start Timestamp of the start of the new ProtocolGovernance
    event StagedProtocolGovernance(
        address indexed origin,
        address indexed sender,
        IProtocolGovernance newProtocolGovernance,
        uint256 start
    );

    /// @param origin Origin of the transaction
    /// @param sender Sender of the transaction
    /// @param newProtocolGovernance Address of the new ProtocolGovernance that has been committed
    event CommitedProtocolGovernance(
        address indexed origin,
        address indexed sender,
        IProtocolGovernance newProtocolGovernance
    );
}
