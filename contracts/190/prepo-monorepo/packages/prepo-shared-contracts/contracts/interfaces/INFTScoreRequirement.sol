// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @notice Module for evaluating NFT-based criteria using fixed scores
 * assigned to the presence of a NFT collection within an account.
 * @dev The inheriting contract can check if an account's score passes the
 * required score using the internal function `_satisfiesScoreRequirement`.
 */
interface INFTScoreRequirement {
  /**
   * @dev Emitted by `setRequiredScore()`.
   * @param score The new required score threshold
   */
  event RequiredScoreChange(uint256 score);

  /**
   * @dev Emitted by `setCollectionScores()`.
   * @param collections ERC721 contracts that had score changed
   * @param scores The scores assigned to contracts in `collections`
   */
  event CollectionScoresChange(IERC721[] collections, uint256[] scores);

  /**
   * @notice Sets the required score threshold an account must satisfy.
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   * @param requiredScore The new required score
   */
  function setRequiredScore(uint256 requiredScore) external;

  /**
   * @notice Assigns scores in `scores` to corresponding ERC721 contracts 
   * in `collections`.
   * @dev Explicitly assigning a score of 0 to a collection is not allowed
   * to prevent populating the enumerable list with 0-score entries.
   *
   * This function is meant to be overriden and does not include any
   * access controls.
   */
  function setCollectionScores(IERC721[] memory collections, uint256[] memory scores) external;

  /**
   * @notice Removes `collections` from the score mapping, giving them an
   * implicit score of 0.
   *
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   */
  function removeCollections(IERC721[] memory collections) external;

  /// @return The required score threshold
  function getRequiredScore() external view returns (uint256);

  /// @return The score assigned to `collection`
  function getCollectionScore(IERC721 collection) external view returns (uint256);

  /**
   * @notice Calculates the score for `account` based on the NFT's it
   * currently holds. Presence of a NFT within a collection is only counted
   * once towards an account's score and is irrespective of quantity.
   * @return The current score for `account`
   */
  function getAccountScore(address account) external view returns (uint256);
}
