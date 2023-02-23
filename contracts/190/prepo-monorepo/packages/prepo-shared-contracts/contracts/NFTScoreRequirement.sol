// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/INFTScoreRequirement.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract NFTScoreRequirement is INFTScoreRequirement {
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  uint256 internal _requiredScore;
  EnumerableMap.AddressToUintMap private _collectionToScore;

  function _satisfiesScoreRequirement(address account) internal view virtual returns (bool) {
    return _requiredScore == 0 || getAccountScore(account) >= _requiredScore;
  }

  function setRequiredScore(uint256 requiredScore) public virtual override {
    _requiredScore = requiredScore;
    emit RequiredScoreChange(requiredScore);
  }

  function setCollectionScores(IERC721[] memory collections, uint256[] memory scores) public virtual override {
    require(collections.length == scores.length, "collections.length != scores.length");
    uint256 numCollections = collections.length;
    for (uint256 i = 0; i < numCollections; ) {
      require(scores[i] > 0, "score == 0");
      _collectionToScore.set(address(collections[i]), scores[i]);
      unchecked {
        ++i;
      }
    }
    emit CollectionScoresChange(collections, scores);
  }

  function removeCollections(IERC721[] memory collections) public virtual override {
    uint256 numCollections = collections.length;
    for (uint256 i = 0; i < numCollections; ) {
      _collectionToScore.remove(address(collections[i]));
      unchecked {
        ++i;
      }
    }
    emit CollectionScoresChange(collections, new uint256[](collections.length));
  }

  function getRequiredScore() external view virtual override returns (uint256) {
    return _requiredScore;
  }

  function getCollectionScore(IERC721 collection) external view virtual override returns (uint256) {
    if (_collectionToScore.contains(address(collection))) return _collectionToScore.get(address(collection));
    return 0;
  }

  function getAccountScore(address account) public view virtual override returns (uint256) {
    uint256 score;
    uint256 numCollections = _collectionToScore.length();
    for (uint256 i = 0; i < numCollections; ) {
      (address collection, uint256 collectionScore) = _collectionToScore.at(i);
      score += IERC721(collection).balanceOf(account) > 0 ? collectionScore : 0;
      unchecked {
        ++i;
      }
    }
    return score;
  }
}
