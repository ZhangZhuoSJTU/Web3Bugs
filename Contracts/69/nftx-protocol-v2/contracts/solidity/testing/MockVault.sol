// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ERC721HolderUpgradeable.sol";

contract MockVault is ERC721HolderUpgradeable {
    address public assetAddress;
    bool public is1155;

    constructor(address _assetAddress, bool _is1155) {
        assetAddress = _assetAddress;
        is1155 = _is1155;
    }

    function mintTo(
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address to
    ) public returns (uint256) {
        // TODO
    }

}
