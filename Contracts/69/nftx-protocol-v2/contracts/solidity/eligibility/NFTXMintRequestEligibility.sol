// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interface/INFTXVault.sol";
import "../testing/IERC721.sol";
import "../token/IERC1155Upgradeable.sol";
import "../token/ERC721HolderUpgradeable.sol";
import "../token/ERC1155HolderUpgradeable.sol";
import "../util/PausableUpgradeable.sol";
import "../util/SafeMathUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

// onlyOwnerIfPaused only 0.
// 0: requestMint
// 0: approveMintRequests
// 0: setUniqueEligibilities

contract NFTXMintRequestEligibility is
    PausableUpgradeable,
    UniqueEligibility,
    NFTXEligibility,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeMathUpgradeable for uint256;

    function name() public pure override virtual returns (string memory) {
        return "MintRequest";
    }

    function finalized() public view override virtual returns (bool) {
        return isInitialized && owner() == address(0);
    }

    function targetAsset() public pure override virtual returns (address) {
        return address(0);
    }

    INFTXVault public vault;
    bool public isInitialized;
    bool public is1155;
    bool public negateEligOnRedeem;
    bool public allowTrustedApprovals;

    mapping(address => mapping(uint256 => bool)) approvedMints;
    mapping(address => mapping(uint256 => uint256)) mintRequests;

    struct Config {
        address owner;
        address vaultAddress;
        bool negateEligOnRedeem;
        uint256[] tokenIds;
    }

    event NFTXEligibilityInit(address owner, uint256[] tokenIds);

    event AllowTrustedApprovalsSet(bool allow);

    event Request(address sender, uint256[] nftIds, uint256[] amounts);
    event Reject(uint256[] nftIds);
    event Approve(uint256[] nftIds);

    function __NFTXEligibility_init_bytes(bytes memory _configData)
        public
        override
        virtual
        initializer
    {
        (address _owner, address _vault, bool _negateElig, uint256[] memory _ids) = abi
            .decode(_configData, (address, address, bool, uint256[]));
        __NFTXEligibility_init(_owner, _vault, _negateElig, _ids);
    }

    function __NFTXEligibility_init(
        address _owner,
        address vaultAddress,
        bool _negateEligOnRedeem,
        uint256[] memory tokenIds
    ) public initializer {
        __Ownable_init();
        isInitialized = true;
        _setUniqueEligibilities(tokenIds, true);
        transferOwnership(_owner);
        // Approve for future usage.
        // Same function on both 721 and 1155.
        vault = INFTXVault(vaultAddress);
        negateEligOnRedeem = _negateEligOnRedeem;
        is1155 = INFTXVault(vaultAddress).is1155();
        address _assetAddress = INFTXVault(vaultAddress).assetAddress();
        IERC1155Upgradeable(_assetAddress).setApprovalForAll(
            address(vault),
            true
        );
        emit NFTXEligibilityInit(_owner, tokenIds);
    }

    function finalizeEligibility() external virtual onlyOwner {
        // Maybe add a bool here to pause verything.
        renounceOwnership();
    }

    function setEligibilityPreferences(bool _allowTrustedApprovals)
        external
        virtual
        onlyOwner
    {
        allowTrustedApprovals = _allowTrustedApprovals;
        emit AllowTrustedApprovalsSet(_allowTrustedApprovals);
    }

    function requestMint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external virtual {
        onlyOwnerIfPaused(0);
        require(tokenIds.length == amounts.length);
        bool _is1155 = is1155;
        address _assetAddress = vault.assetAddress();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = amounts[i];
            require(
                mintRequests[msg.sender][tokenId] == 0,
                "No existing request"
            );
            mintRequests[msg.sender][tokenId] = amount;
            if (_is1155) {
                require(amount > 0, "Must request with at least one");
                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    msg.sender,
                    address(this),
                    tokenId,
                    amount,
                    ""
                );
            } else {
                require(amount == 1, "Must request with only one");
                IERC721(_assetAddress).safeTransferFrom(
                    msg.sender,
                    address(this),
                    tokenId
                );
            }
        }
        emit Request(msg.sender, tokenIds, amounts);
    }

    function approveMintRequests(
        uint256[] calldata tokenIds,
        address[] calldata addresses,
        bool mint
    ) external virtual {
        onlyOwnerIfPaused(0);
        require(tokenIds.length == addresses.length);
        if (!allowTrustedApprovals || !isGuardian[msg.sender]) {
            onlyPrivileged();
        }
        INFTXVault _vault = vault;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = mintRequests[addresses[i]][tokenId];
            require(amount > 0, "No requests");
            if (mint) {
                approvedMints[addresses[i]][tokenId] = false;
                mintRequests[addresses[i]][tokenId] = 0;
                uint256[] memory _tokenIds = new uint256[](1);
                uint256[] memory _amounts = new uint256[](1);
                _tokenIds[0] = tokenId;
                _amounts[0] = amount;
                _setUniqueEligibilities(_tokenIds, true);
                _vault.mintTo(_tokenIds, _amounts, addresses[i]);
            } else {
                approvedMints[addresses[i]][tokenId] = true;
            }
        }
        emit Approve(tokenIds);
    }

    function claimUnminted(
        uint256[] calldata tokenIds,
        address[] calldata addresses
    ) external virtual {
        require(tokenIds.length == addresses.length);
        INFTXVault _vault = vault;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = mintRequests[addresses[i]][tokenId];
            require(amount > 0, "No requests");
            require(approvedMints[addresses[i]][tokenId], "Not approved");
            approvedMints[addresses[i]][tokenId] = false;
            mintRequests[addresses[i]][tokenId] = 0;
            uint256[] memory _tokenIds = new uint256[](1);
            uint256[] memory _amounts = new uint256[](1);
            _tokenIds[0] = tokenId;
            _amounts[0] = amount;
            _setUniqueEligibilities(_tokenIds, true);
            _vault.mintTo(_tokenIds, _amounts, addresses[i]);
        }
    }

    function reclaimRequestedMint(uint256[] calldata tokenIds)
        external
        virtual
    {
        address _assetAddress = vault.assetAddress();
        bool _is1155 = is1155;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = mintRequests[msg.sender][tokenId];
            require(amount > 0, "NFTXVault: nothing to reclaim");
            require(!approvedMints[msg.sender][tokenId], "Eligibility: cannot be approved");
            mintRequests[msg.sender][tokenId] = 0;
            approvedMints[msg.sender][tokenId] = false;
            if (_is1155) {
                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    msg.sender,
                    tokenId,
                    amount,
                    ""
                );
            } else {
                IERC721(_assetAddress).safeTransferFrom(
                    address(this),
                    msg.sender,
                    tokenId
                );
            }
        }
    }

    function setUniqueEligibilities(uint256[] memory tokenIds, bool _isEligible)
        external
        virtual
    {
        if (!allowTrustedApprovals || !isGuardian[msg.sender]) {
            onlyPrivileged();
        } else {
            onlyOwnerIfPaused(0);
        }
        _setUniqueEligibilities(tokenIds, _isEligible);
    }
    
    function afterRedeemHook(uint256[] calldata tokenIds) external override virtual {
        require(msg.sender == address(vault));
        if (negateEligOnRedeem) {
            _setUniqueEligibilities(tokenIds, false);
        }
    }

    function _checkIfEligible(uint256 _tokenId)
        internal
        view
        override
        virtual
        returns (bool)
    {
        return isUniqueEligible(_tokenId);
    }

    function onlyPrivileged() internal view {
        require(msg.sender == owner(), "Not owner");
    }
}
