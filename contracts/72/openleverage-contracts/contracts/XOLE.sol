// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./lib/SignedSafeMath128.sol";
import "./Adminable.sol";
import "./DelegateInterface.sol";
import "./XOLEInterface.sol";
import "./DelegateInterface.sol";
import "./lib/DexData.sol";


/// @title Voting Escrowed Token
/// @author OpenLeverage
/// @notice Lock OLE to get time and amount weighted xOLE
/// @dev The weight in this implementation is linear, and lock cannot be more than maxtime (4 years)
contract XOLE is DelegateInterface, Adminable, XOLEInterface, XOLEStorage, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SignedSafeMath128 for int128;
    using DexData for bytes;

    /* We cannot really do block numbers per se b/c slope is per time, not per block
    and per block could be fairly bad b/c Ethereum changes blocktimes.
    What we can do is to extrapolate ***At functions
    */
    constructor() {
    }

    /// @notice initialize proxy contract
    /// @dev This function is not supposed to call multiple times. All configs can be set through other functions.
    /// @param _oleToken Address of contract _oleToken.
    /// @param _dexAgg Contract DexAggregatorDelegator.
    /// @param _devFundRatio Ratio of token reserved to Dev team
    /// @param _dev Address of Dev team.
    function initialize(
        address _oleToken,
        DexAggregatorInterface _dexAgg,
        uint _devFundRatio,
        address _dev
    ) public {
        require(msg.sender == admin, "Not admin");
        require(_oleToken != address(0), "_oleToken address cannot be 0");
        require(_dev != address(0), "_dev address cannot be 0");
        oleToken = IERC20(_oleToken);
        devFundRatio = _devFundRatio;
        dev = _dev;
        dexAgg = _dexAgg;
    }

    function setDexAgg(DexAggregatorInterface newDexAgg) external override onlyAdmin {
        dexAgg = newDexAgg;
    }

    // Fees sharing functions  =====

    function withdrawDevFund() external override {
        require(msg.sender == dev, "Dev only");
        require(devFund != 0, "No fund to withdraw");
        uint toSend = devFund;
        devFund = 0;
        oleToken.transfer(dev, toSend);
    }

    /// @dev swap feeCollected to reward token
    function convertToSharingToken(uint amount, uint minBuyAmount, bytes memory dexData) external override onlyAdminOrDeveloper() {
        require(totalSupply > 0, "Can't share without locked OLE");
        address fromToken;
        address toToken;
        // If no swapping, then assuming OLE reward distribution
        if (dexData.length == 0) {
            fromToken = address(oleToken);
        }
        // Not OLE
        else {
            if (dexData.isUniV2Class()) {
                address[] memory path = dexData.toUniV2Path();
                fromToken = path[0];
                toToken = path[path.length - 1];
            } else {
                DexData.V3PoolData[] memory path = dexData.toUniV3Path();
                fromToken = path[0].tokenA;
                toToken = path[path.length - 1].tokenB;
            }
        }
        uint newReward;
        if (fromToken == address(oleToken)) {
            uint claimable = totalRewarded.sub(withdrewReward);
            uint toShare = oleToken.balanceOf(address(this)).sub(claimable).sub(totalLocked).sub(devFund);
            require(toShare >= amount, 'Exceed OLE balance');
            newReward = toShare;
        } else {
            require(IERC20(fromToken).balanceOf(address(this)) >= amount, "Exceed available balance");
            (IERC20(fromToken)).safeApprove(address(dexAgg), 0);
            (IERC20(fromToken)).safeApprove(address(dexAgg), amount);
            newReward = dexAgg.sellMul(amount, minBuyAmount, dexData);
        }
        //fromToken or toToken equal OLE ,update reward
        if (fromToken == address(oleToken) || toToken == address(oleToken)) {
            uint newDevFund = newReward.mul(devFundRatio).div(10000);
            newReward = newReward.sub(newDevFund);
            devFund = devFund.add(newDevFund);
            totalRewarded = totalRewarded.add(newReward);
            lastUpdateTime = block.timestamp;
            rewardPerTokenStored = rewardPerToken(newReward);
            emit RewardAdded(fromToken, amount, newReward);
        } else {
            emit RewardConvert(fromToken, toToken, amount, newReward);
        }

    }

    /// @notice calculate the amount of token reward
    function earned(address account) external override view returns (uint) {
        return earnedInternal(account);
    }

    function earnedInternal(address account) internal view returns (uint) {
        return (balances[account])
        .mul(rewardPerToken(0).sub(userRewardPerTokenPaid[account]))
        .div(1e18)
        .add(rewards[account]);
    }

    function rewardPerToken(uint newReward) internal view returns (uint) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        if (block.timestamp == lastUpdateTime) {
            return rewardPerTokenStored.add(newReward
            .mul(1e18)
            .div(totalSupply));
        } else {
            return rewardPerTokenStored;
        }
    }

    /// @notice transfer rewarded ole to msg.sender
    function withdrawReward() external override {
        uint reward = getReward();
        oleToken.safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function getReward() internal updateReward(msg.sender) returns (uint) {
        uint reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            withdrewReward = withdrewReward.add(reward);
        }
        return reward;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken(0);
        rewards[account] = earnedInternal(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    /*** Admin Functions ***/
    function setDevFundRatio(uint newRatio) external override onlyAdmin {
        require(newRatio <= 10000);
        devFundRatio = newRatio;
    }

    function setDev(address newDev) external override onlyAdmin {
        dev = newDev;
    }


    function _mint(address account, uint amount) internal {
        totalSupply = totalSupply.add(amount);
        balances[account] = balances[account].add(amount);
        emit Transfer(address(0), account, amount);
        if (delegates[account] == address(0)) {
            delegates[account] = account;
        }
        _moveDelegates(address(0), delegates[account], amount);
        _updateTotalSupplyCheckPoints();
    }

    function _burn(address account) internal {
        uint burnAmount = balances[account];
        totalSupply = totalSupply.sub(burnAmount);
        balances[account] = 0;
        emit Transfer(account, address(0), burnAmount);
        _moveDelegates(delegates[account], address(0), burnAmount);
        _updateTotalSupplyCheckPoints();
    }

    function _updateTotalSupplyCheckPoints() internal {
        uint32 blockNumber = safe32(block.number, "block number exceeds 32 bits");
        if (totalSupplyNumCheckpoints > 0 && totalSupplyCheckpoints[totalSupplyNumCheckpoints - 1].fromBlock == blockNumber) {
            totalSupplyCheckpoints[totalSupplyNumCheckpoints - 1].votes = totalSupply;
        }
        else {
            totalSupplyCheckpoints[totalSupplyNumCheckpoints] = Checkpoint(blockNumber, totalSupply);
            totalSupplyNumCheckpoints = totalSupplyNumCheckpoints + 1;
        }

    }

    function balanceOf(address addr) external view override returns (uint256){
        return balances[addr];
    }

    /// @dev get supply amount by blocknumber
    function totalSupplyAt(uint256 blockNumber) external view returns (uint){
        if (totalSupplyNumCheckpoints == 0) {
            return 0;
        }
        if (totalSupplyCheckpoints[totalSupplyNumCheckpoints - 1].fromBlock <= blockNumber) {
            return totalSupplyCheckpoints[totalSupplyNumCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (totalSupplyCheckpoints[0].fromBlock > blockNumber) {
            return 0;
        }

        uint lower;
        uint upper = totalSupplyNumCheckpoints - 1;
        while (upper > lower) {
            uint center = upper - (upper - lower) / 2;
            // ceil, avoiding overflow
            Checkpoint memory cp = totalSupplyCheckpoints[center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return totalSupplyCheckpoints[lower].votes;
    }

    /// @notice Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`
    /// @param _value Amount to deposit
    /// @param _unlock_time Epoch time when tokens unlock, rounded down to whole weeks
    function create_lock(uint256 _value, uint256 _unlock_time) external override nonReentrant() {
        // Locktime is rounded down to weeks
        uint256 unlock_time = _unlock_time.div(WEEK).mul(WEEK);
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0, "Non zero value");
        require(_locked.amount == 0, "Withdraw old tokens first");
        require(unlock_time > block.timestamp, "Can only lock until time in the future");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 4 years max");

        _deposit_for(msg.sender, _value, unlock_time, _locked, CREATE_LOCK_TYPE);
    }

    
    /// @notice Deposit `_value` additional tokens for `msg.sender`
    /// without modifying the unlock time
    /// @param _value Amount of tokens to deposit and add to the lock
    function increase_amount(uint256 _value) external override nonReentrant() {
        LockedBalance memory _locked = locked[msg.sender];
        require(_value > 0, "need non - zero value");
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");
        _deposit_for(msg.sender, _value, 0, _locked, INCREASE_LOCK_AMOUNT);
    }

    /// @notice Extend the unlock time for `msg.sender` to `_unlock_time`
    /// @param _unlock_time New epoch time for unlocking
    function increase_unlock_time(uint256 _unlock_time) external override nonReentrant() {
        LockedBalance memory _locked = locked[msg.sender];
        // Locktime is rounded down to weeks
        uint256 unlock_time = _unlock_time.div(WEEK).mul(WEEK);
        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(unlock_time > _locked.end, "Can only increase lock duration");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 4 years max");

        _deposit_for(msg.sender, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME);
    }

    /// @notice Deposit and lock tokens for a user
    /// @param _addr User's wallet address
    /// @param _value Amount to deposit
    /// @param unlock_time New time when to unlock the tokens, or 0 if unchanged
    /// @param _locked Previous locked amount / timestamp
    /// @param _type For event only.
    function _deposit_for(address _addr, uint256 _value, uint256 unlock_time, LockedBalance memory _locked, int128 _type) internal updateReward(_addr) {
        uint256 locked_before = totalLocked;
        totalLocked = locked_before.add(_value);
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount = _locked.amount.add(_value);

        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        locked[_addr] = _locked;

        if (_value != 0) {
            assert(IERC20(oleToken).transferFrom(msg.sender, address(this), _value));
        }

        uint calExtraValue = _value;
        // only increase unlock time
        if (_value == 0) {
            _burn(_addr);
            calExtraValue = locked[_addr].amount;
        }
        uint weekCount = locked[_addr].end.sub(block.timestamp).div(WEEK);
        if (weekCount > 1) {
            uint extraToken = calExtraValue.mul(oneWeekExtraRaise).mul(weekCount - 1).div(10000);
            _mint(_addr, calExtraValue + extraToken);
        } else {
            _mint(_addr, calExtraValue);
        }
        emit Deposit(_addr, _value, _locked.end, _type, block.timestamp);
    }

    /// @notice Withdraw all tokens for `msg.sender`
    /// @dev Only possible if the lock has expired
    function withdraw() external override nonReentrant() updateReward(msg.sender) {
        LockedBalance memory _locked = locked[msg.sender];
        require(_locked.amount >= 0, "Nothing to withdraw");
        require(block.timestamp >= _locked.end, "The lock didn't expire");
        uint256 value = _locked.amount;
        totalLocked = totalLocked.sub(value);
        _locked.end = 0;
        _locked.amount = 0;
        locked[msg.sender] = _locked;
        uint reward = getReward();
        require(IERC20(oleToken).transfer(msg.sender, value.add(reward)));
        _burn(msg.sender);
        emit Withdraw(msg.sender, value, block.timestamp);
        emit RewardPaid(msg.sender, reward);
    }


    /// Delegate votes from `msg.sender` to `delegatee`
    /// @param delegatee The address to delegate votes to
    function delegate(address delegatee) public {
        require(delegatee != address(0), 'delegatee:0x');
        return _delegate(msg.sender, delegatee);
    }

    /// Delegates votes from signatory to `delegatee`
    /// @param delegatee The address to delegate votes to
    /// @param nonce The contract state required to match the signature
    /// @param expiry The time at which to expire the signature
    /// @param v The recovery byte of the signature
    /// @param r Half of the ECDSA signature pair
    /// @param s Half of the ECDSA signature pair
    function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s) public {
        delegateBySigInternal(delegatee, nonce, expiry, v, r, s);
    }

    function delegateBySigs(address delegatee, uint[] memory nonce, uint[] memory expiry, uint8[] memory v, bytes32[] memory r, bytes32[] memory s) public {
        require(nonce.length == expiry.length && nonce.length == v.length && nonce.length == r.length && nonce.length == s.length);
        for (uint i = 0; i < nonce.length; i++) {
            (bool success,) = address(this).call(
                abi.encodeWithSelector(XOLE(address(this)).delegateBySig.selector, delegatee, nonce[i], expiry[i], v[i], r[i], s[i])
            );
            if (!success) emit FailedDelegateBySig(delegatee, nonce[i], expiry[i], v[i], r[i], s[i]);
        }
    }

    function delegateBySigInternal(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s) internal {
        require(delegatee != address(0), 'delegatee:0x');
        require(block.timestamp <= expiry, "delegateBySig: signature expired");

        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "delegateBySig: invalid signature");
        require(nonce == nonces[signatory], "delegateBySig: invalid nonce");

        _delegate(signatory, delegatee);
    }

    /// Gets the current votes balance for `account`
    /// @param account The address to get votes balance
    /// @return The number of current votes for `account`
    function getCurrentVotes(address account) external view returns (uint) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /// Determine the prior number of votes for an account as of a block number
    /// @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
    /// @param account The address of the account to check
    /// @param blockNumber The block number to get the vote balance at
    /// @return The number of votes the account had as of the given block
    function getPriorVotes(address account, uint blockNumber) public view returns (uint) {
        require(blockNumber < block.number, "getPriorVotes:not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2;
            // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        nonces[delegator]++;
        address currentDelegate = delegates[delegator];
        uint delegatorBalance = balances[delegator];
        delegates[delegator] = delegatee;
        emit DelegateChanged(delegator, currentDelegate, delegatee);
        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(address srcRep, address dstRep, uint amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint srcRepNew = srcRepOld.sub(amount);
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint oldVotes, uint newVotes) internal {
        uint32 blockNumber = safe32(block.number, "block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2 ** 32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly {chainId := chainid()}
        return chainId;
    }
}
