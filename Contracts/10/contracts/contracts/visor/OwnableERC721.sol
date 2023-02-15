// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title OwnableERC721
/// @notice Use ERC721 ownership for access control
contract OwnableERC721 {
    address private _nftAddress;

    modifier onlyOwner() {
        require(owner() == msg.sender, "OwnableERC721: caller is not the owner");
        _;
    }

    function _setNFT(address nftAddress) internal {
        _nftAddress = nftAddress;
    }

    function nft() public view virtual returns (address nftAddress) {
        return _nftAddress;
    }

    function owner() public view virtual returns (address ownerAddress) {
        return IERC721(_nftAddress).ownerOf(uint256(address(this)));
    }
}
