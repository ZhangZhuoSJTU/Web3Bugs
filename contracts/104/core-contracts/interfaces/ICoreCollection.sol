//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ICoreCollection {
    function transferOwnership(address) external;

    function initialize(
        string memory,
        string memory,
        string memory,
        uint256,
        uint256,
        address,
        bool,
        address
    ) external;

    function setRoyaltyVault(address _royaltyVault) external;

    function initializeClaims(bytes32 root) external;
}
