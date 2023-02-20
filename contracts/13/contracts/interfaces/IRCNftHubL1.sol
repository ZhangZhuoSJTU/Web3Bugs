// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IRCNftHubL1 {
    function mint(address user, uint256 tokenId) external;

    function mint(
        address user,
        uint256 tokenId,
        bytes calldata metaData
    ) external;

    function exists(uint256 tokenId) external view returns (bool);
}
