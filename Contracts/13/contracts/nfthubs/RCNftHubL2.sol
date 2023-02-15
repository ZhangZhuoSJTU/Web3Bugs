// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";
import "../interfaces/IRCMarket.sol";
import "../lib/NativeMetaTransaction.sol";
import "../interfaces/IRCNftHubL2.sol";

/// @title Reality Cards NFT Hub- Layer 2 side
/// @author Andrew Stanger & Daniel Chilvers
contract RCNftHubL2 is
    Ownable,
    ERC721URIStorage,
    AccessControl,
    NativeMetaTransaction,
    IRCNftHubL2
{
    /*╔═════════════════════════════════╗
      ║           VARIABLES             ║
      ╚═════════════════════════════════╝*/

    /// @dev so only markets can move NFTs
    mapping(address => bool) public isMarket;
    /// @dev the market each NFT belongs to, so that it can only be moved in withdraw state
    mapping(uint256 => address) public override marketTracker;

    /// @dev governance variables
    address public factoryAddress;

    /// @dev matic mintable asset requirements
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    mapping(uint256 => bool) public withdrawnTokens;
    event WithdrawnBatch(address indexed user, uint256[] tokenIds);
    event TransferWithMetadata(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        bytes metaData
    );

    /*╔═════════════════════════════════╗
      ║          CONSTRUCTOR            ║
      ╚═════════════════════════════════╝*/

    constructor(address _factoryAddress, address childChainManager)
        ERC721("RealityCards", "RC")
    {
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsNftHubL2", "1");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(DEPOSITOR_ROLE, childChainManager);
        setFactoryAddress(_factoryAddress);
    }

    /*╔═════════════════════════════════╗
      ║          ADD MARKETS            ║
      ╚═════════════════════════════════╝*/

    /// @dev so only markets can change ownership
    function addMarket(address _newMarket) external override {
        require(msgSender() == factoryAddress, "Not factory");
        isMarket[_newMarket] = true;
    }

    /*╔═════════════════════════════════╗
      ║          GOVERNANCE             ║
      ╚═════════════════════════════════╝*/

    /// @dev address of RC factory contract, so only factory can mint
    function setFactoryAddress(address _newAddress) public onlyOwner {
        require(_newAddress != address(0), "Must set an address");
        factoryAddress = _newAddress;
    }

    /*╔═════════════════════════════════╗
      ║        CORE FUNCTIONS           ║
      ╚═════════════════════════════════╝*/

    // FACTORY ONLY
    function mint(
        address _originalOwner,
        uint256 _tokenId,
        string calldata _tokenURI
    ) external override returns (bool) {
        require(
            !withdrawnTokens[_tokenId],
            "ChildMintableERC721: TOKEN_EXISTS_ON_ROOT_CHAIN"
        );
        require(msgSender() == factoryAddress, "Not factory");
        _mint(_originalOwner, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
        marketTracker[_tokenId] = _originalOwner;
        return true;
    }

    // MARKET ONLY
    function transferNft(
        address _currentOwner,
        address _newOwner,
        uint256 _tokenId
    ) external override returns (bool) {
        require(isMarket[msgSender()], "Not market");
        _transfer(_currentOwner, _newOwner, _tokenId);
        return true;
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
        override(ERC721URIStorage, IRCNftHubL2)
        returns (string memory)
    {
        return ERC721URIStorage.tokenURI(tokenId);
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
            for (uint256 i; i < length; i++) {
                withdrawnTokens[tokenIds[i]] = false;
                _mint(user, tokenIds[i]);
            }
        }
    }

    function withdraw(uint256 tokenId) external override {
        require(isMarket[msgSender()], "Not market");
        require(
            _msgSender() == ownerOf(tokenId),
            "ChildMintableERC721: INVALID_TOKEN_OWNER"
        );
        withdrawnTokens[tokenId] = true;
        _burn(tokenId);
    }

    function withdrawWithMetadata(uint256 tokenId) external override {
        require(isMarket[msgSender()], "Not market");
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721)
        returns (bool)
    {
        return
            interfaceId == type(IRCNftHubL2).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /*╔═════════════════════════════════╗
      ║           OVERRIDES             ║
      ╚═════════════════════════════════╝*/
    /// @dev ensures NFTs can only be moved when market is resolved

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        IRCMarket market = IRCMarket(marketTracker[tokenId]);
        require(market.state() == IRCMarket.States.WITHDRAW, "Incorrect state");
        require(ownerOf(tokenId) == msgSender(), "Not owner");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override {
        IRCMarket market = IRCMarket(marketTracker[tokenId]);
        require(market.state() == IRCMarket.States.WITHDRAW, "Incorrect state");
        require(ownerOf(tokenId) == msgSender(), "Not owner");
        _transfer(from, to, tokenId);
        _data;
    }
    /*
         ▲  
        ▲ ▲ 
              */
}
