// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @title SplitStorage
 * @author MirrorXYZ
 */
contract SplitStorage {
    bytes32 public merkleRoot;
    uint256 public currentWindow;
    address internal splitAsset;
    address internal _splitter;
    uint256[] public balanceForWindow;
    mapping(bytes32 => bool) internal claimed;
    uint256 internal depositedInWindow;
}
