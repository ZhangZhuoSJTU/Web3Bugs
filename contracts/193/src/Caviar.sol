// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "solmate/auth/Owned.sol";

import "./lib/SafeERC20Namer.sol";
import "./Pair.sol";

/// @title caviar.sh
/// @author out.eth (@outdoteth)
/// @notice An AMM for creating and trading fractionalized NFTs.
contract Caviar is Owned {
    using SafeERC20Namer for address;

    event Create(address indexed nft, address indexed baseToken, bytes32 indexed merkleRoot);
    event Destroy(address indexed nft, address indexed baseToken, bytes32 indexed merkleRoot);

    /// @dev pairs[nft][baseToken][merkleRoot] -> pair
    mapping(address => mapping(address => mapping(bytes32 => address))) public pairs;

    constructor() Owned(msg.sender) {}

    /// @notice Creates a new pair.
    /// @param nft The NFT contract address.
    /// @param baseToken The base token contract address.
    /// @param merkleRoot The merkle root for the valid tokenIds.
    /// @return pair The address of the new pair.
    function create(address nft, address baseToken, bytes32 merkleRoot) public returns (Pair pair) {
        // check that the pair doesn't already exist
        require(pairs[nft][baseToken][merkleRoot] == address(0), "Pair already exists");

        // deploy the pair
        string memory baseTokenSymbol = baseToken == address(0) ? "ETH" : baseToken.tokenSymbol();
        string memory nftSymbol = nft.tokenSymbol();
        string memory nftName = nft.tokenName();
        string memory pairSymbol = string.concat(nftSymbol, ":", baseTokenSymbol);
        pair = new Pair(nft, baseToken, merkleRoot, pairSymbol, nftName, nftSymbol);

        // save the pair
        pairs[nft][baseToken][merkleRoot] = address(pair);

        emit Create(nft, baseToken, merkleRoot);
    }

    /// @notice Deletes the pair for the given NFT, base token, and merkle root.
    /// @param nft The NFT contract address.
    /// @param baseToken The base token contract address.
    /// @param merkleRoot The merkle root for the valid tokenIds.
    function destroy(address nft, address baseToken, bytes32 merkleRoot) public {
        // check that a pair can only destroy itself
        require(msg.sender == pairs[nft][baseToken][merkleRoot], "Only pair can destroy itself");

        // delete the pair
        delete pairs[nft][baseToken][merkleRoot];

        emit Destroy(nft, baseToken, merkleRoot);
    }
}
