// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.10;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

contract Depositors is ERC721 {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    address public vault;

    struct Deposit {
        /// amount of the deposit
        uint256 amount;
        /// wallet of the claimer
        uint256 claimerId;
        /// when can the deposit be withdrawn
        uint256 lockedUntil;
    }

    mapping(uint256 => Deposit) public deposits;

    /// ID of the next NFT to mint
    uint256 nextId;

    modifier onlyVault() {
        require(msg.sender == vault, "Claimers: not authorized");
        _;
    }

    constructor(
        address _vault,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
        vault = _vault;
    }

    // should only be callable by the vault
    // TODO: emit the groupId
    function mint(
        address _owner,
        uint256 _amount,
        uint256 _claimerId,
        uint256 _lockedUntil
    ) external onlyVault returns (uint256) {
        uint256 localTokenId = _tokenIds.current();
        _tokenIds.increment();

        _safeMint(_owner, localTokenId);

        deposits[localTokenId] = Deposit(_amount, _claimerId, _lockedUntil);

        return localTokenId;
    }

    // called when a deposit's principal is withdrawn
    function burn(uint256 _id) external onlyVault {
        _burn(_id);
    }

    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }
}
