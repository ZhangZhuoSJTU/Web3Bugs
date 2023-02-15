// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";
import "../lib/NativeMetaTransaction.sol";
import "../interfaces/IRCNftHubL1.sol";

/// @title Reality Cards NFT Hub- mainnet side
/// @author Andrew Stanger & Daniel Chilvers
contract RCNftHubL1 is
    Ownable,
    ERC721URIStorage,
    AccessControl,
    NativeMetaTransaction,
    IRCNftHubL1
{
    /*╔═════════════════════════════════╗
      ║           VARIABLES             ║
      ╚═════════════════════════════════╝*/

    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");

    /*╔═════════════════════════════════╗
      ║          CONSTRUCTOR            ║
      ╚═════════════════════════════════╝*/

    constructor() ERC721("RealityCards", "RC") {
        // initialise MetaTransactions
        _initializeEIP712("RealityCardsNftHubL1", "1");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());
    }

    /*╔═════════════════════════════════╗
      ║        CORE FUNCTIONS           ║
      ╚═════════════════════════════════╝*/

    function mint(address user, uint256 tokenId)
        external
        override
        onlyRole(PREDICATE_ROLE)
    {
        _mint(user, tokenId);
    }

    function mint(
        address user,
        uint256 tokenId,
        bytes calldata metaData
    ) external override onlyRole(PREDICATE_ROLE) {
        _mint(user, tokenId);

        setTokenMetadata(tokenId, metaData);
    }

    function setTokenMetadata(uint256 tokenId, bytes memory data)
        internal
        virtual
    {
        string memory uri = abi.decode(data, (string));
        _setTokenURI(tokenId, uri);
    }

    function exists(uint256 tokenId) external view override returns (bool) {
        return _exists(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721)
        returns (bool)
    {
        return
            interfaceId == type(IRCNftHubL1).interfaceId ||
            super.supportsInterface(interfaceId);
    }
    /*
         ▲  
        ▲ ▲ 
              */
}
