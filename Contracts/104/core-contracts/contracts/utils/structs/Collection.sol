//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

struct Collection {
    bool isForSale;
    uint256 maxSupply;
    uint256 mintFee;
    string baseURI;
    string name;
    string symbol;
    string id;
    bytes32 claimsMerkleRoot;
    address payableToken;
}
