// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../interface/INFTXVault.sol";
import "../token/IERC721Upgradeable.sol";
import "../token/IERC1155Upgradeable.sol";
import "../token/ERC721HolderUpgradeable.sol";
import "../token/ERC1155HolderUpgradeable.sol";
import "../util/PausableUpgradeable.sol";
import "../util/SafeMathUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

contract NFTXMintRequestEligibility is
    PausableUpgradeable,
    UniqueEligibility,
    NFTXEligibility,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeMathUpgradeable for uint256;

    function name() public view override virtual returns (string memory) {
        return "MintRequest";
    }

    address public manager;
    INFTXVault public vault;
    bool public is1155;
    bool public reverseEligOnRedeem;
    bool public allowTrustedApprovals;

    mapping(address => mapping(uint256 => bool)) approvedMints;
    mapping(address => mapping(uint256 => uint256)) mintRequests;

    struct Config {
        address owner;
        address vaultAddress;
        bool reverseEligOnRedeem;
        uint256[] tokenIds;
    }

    event CanApproveMintRequestsSet(address[] addresses, bool canApprove);
    event NFTXEligibilityInit(address owner, uint256[] tokenIds);

    event AllowTrustedApprovalsSet(bool allow);

    event Request(address sender, uint256[] nftIds, uint256[] amounts);
    event Reject(uint256[] nftIds);
    event Approve(uint256[] nftIds);

    /* constructor() public {
        __Ownable_init();
        renounceOwnership();
    } */

    function __NFTXEligibility_init_bytes(bytes memory _configData)
        public
        override
        virtual
        initializer
    {
        __Ownable_init();
        (address _owner, address _vault, bool _reverseElig, uint256[] memory _ids) = abi
            .decode(_configData, (address, address, bool, uint256[]));
        __NFTXEligibility_init(_owner, _vault, _reverseElig, _ids);
    }

    function __NFTXEligibility_init(
        address _owner,
        address vaultAddress,
        bool _reverseEligOnRedeem,
        uint256[] memory tokenIds
    ) public initializer {
        __Ownable_init();
        _setUniqueEligibilities(tokenIds, true);
        transferOwnership(_owner);
        // Approve for future usage.
        // Same function on both 721 and 1155.
        vault = INFTXVault(vaultAddress);
        reverseEligOnRedeem = _reverseEligOnRedeem;
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
        require(!finalized(), "Finalized");
        address _assetAddress = vault.assetAddress();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = amounts[i];
            require(
                mintRequests[msg.sender][tokenId] == 0,
                "No existing request"
            );
            mintRequests[msg.sender][tokenId] = amount;
            if (is1155) {
                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    msg.sender,
                    address(this),
                    tokenId,
                    amount,
                    ""
                );
            } else {
                IERC721Upgradeable(_assetAddress).safeTransferFrom(
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
        // Add here? Allow approval if finalized?
        require(!finalized(), "Finalized");
        if (!allowTrustedApprovals || !isGuardian[msg.sender]) {
            onlyPrivileged();
        }
        require(tokenIds.length == addresses.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = mintRequests[addresses[i]][tokenId];
            require(amount > 0, "No requests");
            if (mint) {
                approvedMints[addresses[i]][tokenId] = false;
                mintRequests[addresses[i]][tokenId] = 0;
                uint256[] memory _tokenIds;
                uint256[] memory _amounts;
                _tokenIds[0] = tokenId;
                _amounts[0] = amount;
                vault.mintTo(_tokenIds, _amounts, addresses[i]);
            } else {
                approvedMints[addresses[i]][tokenId] = true;
            }
        }
        return;
    }

    function claimUnminted(
        uint256[] calldata tokenIds,
        address[] calldata addresses
    ) external virtual {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = mintRequests[addresses[i]][tokenId];
            require(amount > 0, "No requests");
            require(approvedMints[addresses[i]][tokenId], "Not approved");
            approvedMints[addresses[i]][tokenId] = false;
            mintRequests[addresses[i]][tokenId] = 0;
            uint256[] memory _tokenIds;
            uint256[] memory _amounts;
            _tokenIds[0] = tokenId;
            _amounts[0] = amount;
            vault.mintTo(_tokenIds, _amounts, addresses[i]);
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
                IERC721Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    msg.sender,
                    tokenId
                );
            }
        }
    }

    function setUniqueEligibilities(uint256[] memory tokenIds, bool _isEligible)
        public
        virtual
    {
        if (!allowTrustedApprovals || !isGuardian[msg.sender]) {
            onlyPrivileged();
        }
        _setUniqueEligibilities(tokenIds, _isEligible);
    }

    function finalized() public view override virtual returns (bool) {
        return owner() == address(0);
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
