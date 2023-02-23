// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {GamifiedToken} from "./GamifiedToken.sol";
import {IGovernanceHook} from "./interfaces/IGovernanceHook.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title GamifiedVotingToken
 * @notice GamifiedToken is a checkpointed Voting Token derived from OpenZeppelin "ERC20VotesUpgradable"
 * @author mStable
 * @dev Forked from https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/f9cdbd7d82d45a614ee98a5dc8c08fb4347d0fea/contracts/token/ERC20/extensions/ERC20VotesUpgradeable.sol
 * Changes:
 *   - Inherits custom GamifiedToken rather than basic ERC20
 *     - Removal of `Permit` functionality & `delegatebySig`
 *   - Override `delegates` fn as described in their docs
 *   - Prettier formatting
 *   - Addition of `totalSupply` method to get latest totalSupply
 *   - Move totalSupply checkpoints to `afterTokenTransfer`
 *   - Add _governanceHook hook
 */
abstract contract GamifiedVotingToken is Initializable, GamifiedToken {
  struct Checkpoint {
    uint32 fromBlock;
    uint224 votes;
  }

  mapping(address => address) private _delegates;
  mapping(address => Checkpoint[]) private _checkpoints;
  Checkpoint[] private _totalSupplyCheckpoints;

  IGovernanceHook private _governanceHook;

  event GovernanceHookChanged(address indexed hook);

  /**
   * @dev Emitted when an account changes their delegate.
   */
  event DelegateChanged(
    address indexed delegator,
    address indexed fromDelegate,
    address indexed toDelegate
  );

  /**
   * @dev Emitted when a token transfer or delegate change results in changes to an account's voting power.
   */
  event DelegateVotesChanged(
    address indexed delegate,
    uint256 previousBalance,
    uint256 newBalance
  );

  constructor(
    address _nexus,
    address _rewardsToken,
    address _questManager,
    bool _hasPriceCoeff
  ) GamifiedToken(_nexus, _rewardsToken, _questManager, _hasPriceCoeff) {}

  function __GamifiedVotingToken_init() internal initializer {}

  /**
   * @dev
   */
  function setGovernanceHook(address _newHook) external onlyGovernor {
    _governanceHook = IGovernanceHook(_newHook);

    emit GovernanceHookChanged(_newHook);
  }

  /**
   * @dev Get the `pos`-th checkpoint for `account`.
   */
  function checkpoints(address account, uint32 pos)
    public
    view
    virtual
    returns (Checkpoint memory)
  {
    return _checkpoints[account][pos];
  }

  /**
   * @dev Get number of checkpoints for `account`.
   */
  function numCheckpoints(address account)
    public
    view
    virtual
    returns (uint32)
  {
    return SafeCast.toUint32(_checkpoints[account].length);
  }

  /**
   * @dev Get the address the `delegator` is currently delegating to.
   * Return the `delegator` account if not delegating to anyone.
   * @param delegator the account that is delegating the votes from
   * @return delegatee that is receiving the delegated votes
   */
  function delegates(address delegator) public view virtual returns (address) {
    // Override as per https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/token/ERC20/extensions/ERC20VotesUpgradeable.sol#L23
    // return _delegates[account];
    address delegatee = _delegates[delegator];
    return delegatee == address(0) ? delegator : delegatee;
  }

  /**
   * @dev Gets the current votes balance for `account`
   */
  function getVotes(address account) public view returns (uint256) {
    uint256 pos = _checkpoints[account].length;
    return pos == 0 ? 0 : _checkpoints[account][pos - 1].votes;
  }

  /**
   * @dev Retrieve the number of votes for `account` at the end of `blockNumber`.
   *
   * Requirements:
   *
   * - `blockNumber` must have been already mined
   */
  function getPastVotes(address account, uint256 blockNumber)
    public
    view
    returns (uint256)
  {
    require(blockNumber < block.number, "ERC20Votes: block not yet mined");
    return _checkpointsLookup(_checkpoints[account], blockNumber);
  }

  /**
   * @dev Retrieve the `totalSupply` at the end of `blockNumber`. Note, this value is the sum of all balances.
   * It is but NOT the sum of all the delegated votes!
   *
   * Requirements:
   *
   * - `blockNumber` must have been already mined
   */
  function getPastTotalSupply(uint256 blockNumber)
    public
    view
    returns (uint256)
  {
    require(blockNumber < block.number, "ERC20Votes: block not yet mined");
    return _checkpointsLookup(_totalSupplyCheckpoints, blockNumber);
  }

  /**
   * @dev Total sum of all scaled balances
   */
  function totalSupply() public view override returns (uint256) {
    uint256 len = _totalSupplyCheckpoints.length;
    if (len == 0) return 0;
    return _totalSupplyCheckpoints[len - 1].votes;
  }

  /**
   * @dev Lookup a value in a list of (sorted) checkpoints.
   */
  function _checkpointsLookup(Checkpoint[] storage ckpts, uint256 blockNumber)
    private
    view
    returns (uint256)
  {
    // We run a binary search to look for the earliest checkpoint taken after `blockNumber`.
    //
    // During the loop, the index of the wanted checkpoint remains in the range [low, high).
    // With each iteration, either `low` or `high` is moved towards the middle of the range to maintain the invariant.
    // - If the middle checkpoint is after `blockNumber`, we look in [low, mid)
    // - If the middle checkpoint is before or equal to `blockNumber`, we look in [mid+1, high)
    // Once we reach a single value (when low == high), we've found the right checkpoint at the index high-1, if not
    // out of bounds (in which case we're looking too far in the past and the result is 0).
    // Note that if the latest checkpoint available is exactly for `blockNumber`, we end up with an index that is
    // past the end of the array, so we technically don't find a checkpoint after `blockNumber`, but it works out
    // the same.
    uint256 high = ckpts.length;
    uint256 low = 0;
    while (low < high) {
      uint256 mid = MathUpgradeable.average(low, high);
      if (ckpts[mid].fromBlock > blockNumber) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return high == 0 ? 0 : ckpts[high - 1].votes;
  }

  /**
   * @dev Delegate votes from the sender to `delegatee`.
   * If `delegatee` is zero, the sender gets the voting power.
   * @param delegatee account that gets the voting power.
   */
  function delegate(address delegatee) public virtual {
    return _delegate(_msgSender(), delegatee);
  }

  /**
   * @dev Move voting power when tokens are transferred.
   *
   * Emits a {DelegateVotesChanged} event.
   */
  function _afterTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._afterTokenTransfer(from, to, amount);

    // mint or burn, update total supply
    if (from == address(0) || to == address(0)) {
      _writeCheckpoint(
        _totalSupplyCheckpoints,
        to == address(0) ? _subtract : _add,
        amount
      );
    }

    _moveVotingPower(delegates(from), delegates(to), amount);
  }

  /**
   * @dev Change delegation for `delegator` to `delegatee`.
   *
   * Emits events {DelegateChanged} and {DelegateVotesChanged}.
   */
  function _delegate(address delegator, address delegatee) internal virtual {
    address currentDelegatee = delegates(delegator);
    uint256 delegatorBalance = balanceOf(delegator);

    _delegates[delegator] = delegatee;
    delegatee = delegates(delegator);

    emit DelegateChanged(delegator, currentDelegatee, delegatee);

    _moveVotingPower(currentDelegatee, delegatee, delegatorBalance);
  }

  function _moveVotingPower(
    address src,
    address dst,
    uint256 amount
  ) private {
    if (src != dst && amount > 0) {
      if (src != address(0)) {
        (uint256 oldWeight, uint256 newWeight) = _writeCheckpoint(
          _checkpoints[src],
          _subtract,
          amount
        );
        emit DelegateVotesChanged(src, oldWeight, newWeight);
      }

      if (dst != address(0)) {
        (uint256 oldWeight, uint256 newWeight) = _writeCheckpoint(
          _checkpoints[dst],
          _add,
          amount
        );
        emit DelegateVotesChanged(dst, oldWeight, newWeight);
      }

      if (address(_governanceHook) != address(0)) {
        _governanceHook.moveVotingPowerHook(src, dst, amount);
      }
    }
  }

  function _writeCheckpoint(
    Checkpoint[] storage ckpts,
    function(uint256, uint256) view returns (uint256) op,
    uint256 delta
  ) private returns (uint256 oldWeight, uint256 newWeight) {
    uint256 pos = ckpts.length;
    oldWeight = pos == 0 ? 0 : ckpts[pos - 1].votes;
    newWeight = op(oldWeight, delta);

    if (pos > 0 && ckpts[pos - 1].fromBlock == block.number) {
      ckpts[pos - 1].votes = SafeCast.toUint224(newWeight);
    } else {
      ckpts.push(
        Checkpoint({
          fromBlock: SafeCast.toUint32(block.number),
          votes: SafeCast.toUint224(newWeight)
        })
      );
    }
  }

  function _add(uint256 a, uint256 b) private pure returns (uint256) {
    return a + b;
  }

  function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
    return a - b;
  }

  uint256[46] private __gap;
}
