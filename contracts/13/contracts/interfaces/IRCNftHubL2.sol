// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IRCNftHubL2 {
    function marketTracker(uint256) external view returns (address);

    function ownerOf(uint256) external view returns (address);

    function tokenURI(uint256) external view returns (string memory);

    function addMarket(address) external;

    function mint(
        address,
        uint256,
        string calldata
    ) external returns (bool);

    function transferNft(
        address,
        address,
        uint256
    ) external returns (bool);

    function deposit(address user, bytes calldata depositData) external;

    function withdraw(uint256 tokenId) external;

    function withdrawWithMetadata(uint256 tokenId) external;
}
