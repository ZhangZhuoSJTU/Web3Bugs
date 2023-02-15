// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";
import "../interfaces/IRCMarket.sol";
import "../interfaces/IRCTreasury.sol";
import "../interfaces/IRCFactory.sol";
import "../lib/NativeMetaTransaction.sol";
import "../interfaces/IRCNftHubL2.sol";

/// @title Reality Cards NFT Hub- Layer 2 side
/// @author Andrew Stanger & Daniel Chilvers
contract RCNftHubL2 is
    Ownable,
    ERC721,
    ERC721URIStorage,
    ERC721Enumerable,
    AccessControl,
    NativeMetaTransaction,
    IRCNftHubL2
{
    /*╔═════════════════════════════════╗
      ║           VARIABLES             ║
      ╚═════════════════════════════════╝*/

    /// @dev so only markets can move NFTs
    mapping(address => bool) public isMarket;
    /// @dev the market each NFT belongs to
    mapping(uint256 => address) public override marketTracker;

    /// @dev governance variables
    IRCFactory public factory;
    IRCTreasury public treasury;
    bytes32 public constant UBER_OWNER = keccak256("UBER_OWNER");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    mapping(uint256 => bool) public withdrawnTokens;
    event TransferWithMetadata(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        bytes metaData
    );

    /*╔═════════════════════════════════╗
      ║           MODIFIERS             ║
      ╚═════════════════════════════════╝*/

    modifier onlyUberOwner() {
        require(
            treasury.checkPermission(UBER_OWNER, msgSender()),
            "Not approved"
        );
        _;
    }

    /*╔═════════════════════════════════╗
      ║          CONSTRUCTOR            ║
      ╚═════════════════════════════════╝*/

    constructor(address _factoryAddress, address childChainManager)
        ERC721("RealityCards", "RC")
    {
        require(
            childChainManager != address(0),
            "Must add childChainManager address"
        );
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsNftHubL2", "1");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, childChainManager);
        factory = IRCFactory(_factoryAddress);
        treasury = factory.treasury();
    }

    /*╔═════════════════════════════════╗
      ║          ADD MARKETS            ║
      ╚═════════════════════════════════╝*/

    /// @dev so only markets can change ownership
    function addMarket(address _newMarket) external override {
        require(msgSender() == address(factory), "Not factory");
        isMarket[_newMarket] = true;
    }

    /*╔═════════════════════════════════╗
      ║          GOVERNANCE             ║
      ╚═════════════════════════════════╝*/

    /// @dev address of RC factory contract, so only factory can mint
    function setFactory(address _newAddress) external onlyUberOwner {
        require(_newAddress != address(0), "Must set an address");
        factory = IRCFactory(_newAddress);
        treasury = factory.treasury();
    }

    function setTokenURI(uint256 _tokenId, string calldata _tokenURI)
        external
        onlyUberOwner
    {
        _setTokenURI(_tokenId, _tokenURI);
    }

    /*╔═════════════════════════════════╗
      ║        CORE FUNCTIONS           ║
      ╚═════════════════════════════════╝*/

    // FACTORY ONLY
    function mint(
        address _originalOwner,
        uint256 _tokenId,
        string calldata _tokenURI
    ) external override {
        require(
            !withdrawnTokens[_tokenId],
            "ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN"
        );
        require(msgSender() == address(factory), "Not factory");
        marketTracker[_tokenId] = _originalOwner;
        _mint(_originalOwner, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
    }

    // MARKET ONLY
    function transferNft(
        address _currentOwner,
        address _newOwner,
        uint256 _tokenId
    ) external override {
        require(marketTracker[_tokenId] == msgSender(), "Not market");
        _transfer(_currentOwner, _newOwner, _tokenId);
    }

    /*╔═════════════════════════════════╗
      ║        MATIC MINTABLE           ║
      ╚═════════════════════════════════╝*/

    function deposit(address user, bytes calldata depositData)
        external
        override
        onlyRole(DEPOSITOR_ROLE)
    {
        // deposit single
        if (depositData.length == 32) {
            uint256 tokenId = abi.decode(depositData, (uint256));
            withdrawnTokens[tokenId] = false;
            _mint(user, tokenId);

            // deposit batch
        } else {
            uint256[] memory tokenIds = abi.decode(depositData, (uint256[]));
            uint256 length = tokenIds.length;
            for (uint256 i = 0; i < length; i++) {
                withdrawnTokens[tokenIds[i]] = false;
                _mint(user, tokenIds[i]);
            }
        }
    }

    function withdraw(uint256 tokenId) external override {
        require(
            _msgSender() == ownerOf(tokenId),
            "ChildMintableERC721: INVALID_TOKEN_OWNER"
        );
        withdrawnTokens[tokenId] = true;
        _burn(tokenId);
    }

    function withdrawWithMetadata(uint256 tokenId) external override {
        require(
            msgSender() == ownerOf(tokenId),
            "ChildMintableERC721: INVALID_TOKEN_OWNER"
        );
        withdrawnTokens[tokenId] = true;

        // Encoding metadata associated with tokenId & emitting event
        emit TransferWithMetadata(
            ownerOf(tokenId),
            address(0),
            tokenId,
            this.encodeTokenMetadata(tokenId)
        );

        _burn(tokenId);
    }

    function encodeTokenMetadata(uint256 tokenId)
        external
        view
        virtual
        returns (bytes memory)
    {
        return abi.encode(tokenURI(tokenId));
    }

    /*╔═════════════════════════════════╗
      ║           OVERRIDES             ║
      ╚═════════════════════════════════╝*/
    /// @dev ensures NFTs can only be moved when market is resolved
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721Enumerable, ERC721) {
        super._beforeTokenTransfer(from, to, tokenId);

        if (
            msgSender() != address(factory) &&
            msgSender() != marketTracker[tokenId]
        ) {
            IRCMarket market = IRCMarket(marketTracker[tokenId]);
            require(
                market.state() == IRCMarket.States.WITHDRAW ||
                    market.state() == IRCMarket.States.LOCKED,
                "Incorrect state"
            );
        }
    }

    function _burn(uint256 _tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(_tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721, ERC721Enumerable)
        returns (bool)
    {
        return
            interfaceId == type(IRCNftHubL2).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function ownerOf(uint256 tokenId)
        public
        view
        virtual
        override(ERC721, IRCNftHubL2)
        returns (address)
    {
        return ERC721.ownerOf(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override(ERC721, ERC721URIStorage, IRCNftHubL2)
        returns (string memory)
    {
        return ERC721URIStorage.tokenURI(tokenId);
    }

    function totalSupply()
        public
        view
        virtual
        override(ERC721Enumerable, IRCNftHubL2)
        returns (uint256)
    {
        return ERC721Enumerable.totalSupply();
    }

    /*
         ▲  
        ▲ ▲ 
              */
}
