// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title An abstraction layer for auctions.
 * @dev This contract can be expanded with reusable calls and data as more auction types are added.
 */
abstract contract NFTMarketAuction is Initializable {
  /**
   * @notice A global id for auctions of any type.
   */
  uint256 private nextAuctionId;

  /**
   * @notice Called once to configure the contract after the initial proxy deployment.
   * @dev This sets the initial auction id to 1, making the first auction cheaper
   * and id 0 represents no auction found.
   */
  function _initializeNFTMarketAuction() internal onlyInitializing {
    nextAuctionId = 1;
  }

  /**
   * @notice Returns id to assign to the next auction.
   */
  function _getNextAndIncrementAuctionId() internal returns (uint256) {
    // AuctionId cannot overflow 256 bits.
    unchecked {
      return nextAuctionId++;
    }
  }

  /**
   * @notice This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
   */
  uint256[1000] private __gap;
}
