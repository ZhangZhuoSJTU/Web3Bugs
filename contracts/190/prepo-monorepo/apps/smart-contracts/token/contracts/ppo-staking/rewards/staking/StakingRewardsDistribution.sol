// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IStakingRewardsDistribution.sol";
import "../../governance/staking/interfaces/IPPOStaking.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract StakingRewardsDistribution is
  IStakingRewardsDistribution,
  SafeOwnable,
  ReentrancyGuard
{
  IPPOStaking private _ppoStaking;
  bytes32 private _root;
  mapping(uint256 => bool) private _userPeriodHashToClaimed;
  uint256 _periodNumber;

  function setPPOStaking(address _newPPOStaking) external override onlyOwner {
    _ppoStaking = IPPOStaking(_newPPOStaking);
  }

  function setMerkleTreeRoot(bytes32 _newRoot) external override onlyOwner {
    _root = _newRoot;
    emit RootUpdate(_newRoot, ++_periodNumber);
  }

  function claim(
    address _account,
    uint256 _amount,
    bytes32[] memory _proof
  ) external override nonReentrant {
    require(
      !_userPeriodHashToClaimed[_getUserPeriodHash(_account)],
      "Already claimed"
    );
    bytes32 _leaf = keccak256(abi.encodePacked(_account, _amount));
    bool _verified = MerkleProof.verify(_proof, _root, _leaf);
    require(_verified, "Invalid claim");
    _userPeriodHashToClaimed[_getUserPeriodHash(_account)] = true;
    _ppoStaking.stake(_account, _amount);
    emit RewardClaim(_account, _amount, _periodNumber);
  }

  function getPPOStaking() external view override returns (address) {
    return address(_ppoStaking);
  }

  function getMerkleTreeRoot() external view override returns (bytes32) {
    return _root;
  }

  function getPeriodNumber() external view override returns (uint256) {
    return _periodNumber;
  }

  function hasClaimed(address _user) external view override returns (bool) {
    return _userPeriodHashToClaimed[_getUserPeriodHash(_user)];
  }

  function _getUserPeriodHash(address _user) private view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(_user, _periodNumber)));
  }
}
