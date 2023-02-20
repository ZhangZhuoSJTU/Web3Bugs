// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IERC721Mintable {
    /**
     * @notice mints an ERC721 token of tokenId to the to address
     * @dev only callable by nft loan facilitator
     * @param to The address to send the token to
     * @param tokenId The id of the token to mint
     */
    function mint(address to, uint256 tokenId) external;
}