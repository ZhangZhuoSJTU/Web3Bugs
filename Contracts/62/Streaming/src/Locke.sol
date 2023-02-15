// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./LockeERC20.sol";
import "solmate/utils/SafeTransferLib.sol";
import "solmate/tokens/ERC20.sol";

// ====== Governance =====
contract Governed {
    address public gov;
    address private pendingGov;
    address public emergency_gov;

    event NewGov(address indexed oldGov, address indexed newGov);
    event NewPendingGov(address indexed oldPendingGov, address indexed newPendingGov);

    constructor(address _governor, address _emergency_governor) public {
        gov = _governor;
        emergency_gov = _emergency_governor;
    }

    function governorship() public view returns (address, address, address) {
        return (gov, emergency_gov, pendingGov);
    }

    /// Update pending governor
    function setPendingGov(address newPendingGov) governed public {
        address old = pendingGov;
        pendingGov = newPendingGov;
        emit NewPendingGov(old, newPendingGov);
    }

    /// Accepts governorship
    function acceptGov() public {
        require(pendingGov == msg.sender, "!pending");
        address old = gov;
        gov = pendingGov;
        emit NewGov(old, pendingGov);
    }

    function setEmergencyGov(address who) public governed {
        emergency_gov = who;
    } 

    /// Remove governor
    function __abdicate() governed public {
        address old = gov;
        gov = address(0);
        emit NewGov(old, address(0));
    }

    // ====== Modifiers =======
    /// Governed function
    modifier governed {
        require(msg.sender == gov, "!gov");
        _;
    }

    /// Emergency governed function
    modifier emergency_governed {
        require(msg.sender == gov || msg.sender == emergency_gov, "!egov");
        _;
    }
}

interface IGoverned {
    function gov() external view returns (address);
    function emergency_gov() external view returns (address);
}

abstract contract ExternallyGoverned {
    IGoverned public gov;

    constructor(address governor) {
        gov = IGoverned(governor);
    }

    // ====== Modifiers =======
    /// Governed function
    modifier externallyGoverned {
        require(msg.sender == gov.gov(), "!gov");
        _;
    }

    /// Emergency governed function
    modifier externallyEmergencyGoverned {
        require(msg.sender == gov.gov() || msg.sender == gov.emergency_gov(), "!e_gov");
        _;
    }
}

interface LockeCallee {
    function lockeCall(address initiator, address token, uint256 amount, bytes calldata data) external;
}

// ====== Stream =====
contract Stream is LockeERC20, ExternallyGoverned {
    using SafeTransferLib for ERC20;    
    // ======= Structs ========
    struct TokenStream {
        uint256 lastCumulativeRewardPerToken;
        uint256 virtualBalance;
        uint112 rewards;
        uint112 tokens;
        uint32 lastUpdate;
        bool merkleAccess;
    }

    // ======= Storage ========
    // ==== Immutables =====
    // stream start time
    uint32 private immutable startTime;
    // length of stream
    uint32 private immutable streamDuration;
    // length of time depositTokens are locked after stream ends
    uint32 private immutable depositLockDuration;
    // length of time rewardTokens are locked after stream ends
    uint32 private immutable rewardLockDuration;

    // end of stream
    uint32 private immutable endStream;
    // end of deposit lock
    uint32 private immutable endDepositLock;
    // end of reward lock
    uint32 private immutable endRewardLock;

    // Token given to depositer
    address public immutable rewardToken;
    // Token deposited
    address public immutable depositToken;

    // This stream's id
    uint64 public immutable streamId;

    // fee percent on reward tokens
    uint16 private immutable feePercent;
    // are fees enabled
    bool private immutable feeEnabled;

    // deposits are basically a *sale* to the stream creator if true
    bool public immutable isSale;

    // stream creator
    address public immutable streamCreator;

    uint112 private immutable depositDecimalsOne;
    // ============

    //  == sloc a ==
    // internal reward token amount to be given to depositors
    uint112 private rewardTokenAmount;
    // internal deposit token amount locked/to be sold to stream creator
    uint112 private depositTokenAmount;
    // ============

    // == slot b ==
    uint112 private rewardTokenFeeAmount;
    uint112 private depositTokenFlashloanFeeAmount;
    uint8 private unlocked = 1;
    bool private claimedDepositTokens;
    // ============

    // == slot c ==
    uint256 private cumulativeRewardPerToken;
    // ============

    // == slot d ==
    uint256 private totalVirtualBalance;
    // ============

    // == slot e ==
    uint112 public unstreamed;
    uint112 private redeemedDepositTokens;
    uint32 private lastUpdate;
    // ============

    // mapping of address to number of tokens not yet streamed over
    mapping (address => TokenStream) public tokensNotYetStreamed;

    // external incentives to stream creator
    mapping (address => uint112) public incentives;

    // ======= Events ========
    event StreamFunded(uint256 amount);
    event Staked(address indexed who, uint256 amount);
    event Withdrawn(address indexed who, uint256 amount);
    event StreamIncentivized(address indexed token, uint256 amount);
    event StreamIncentiveClaimed(address indexed token, uint256 amount);
    event SoldTokensClaimed(address indexed who, uint256 amount);
    event DepositTokensReclaimed(address indexed who, uint256 amount);
    event FeesClaimed(address indexed token, address indexed who, uint256 amount);
    event RecoveredTokens(address indexed token, address indexed recipient, uint256 amount);
    event RewardsClaimed(address indexed who, uint256 amount);
    event Flashloaned(address indexed token, address indexed who, uint256 amount, uint256 fee);

    // ======= Modifiers ========
    modifier updateStream(address who) {
        // save bytecode space by making it a jump instead of inlining at cost of gas
        updateStreamInternal(who);
        _;
    }

    function updateStreamInternal(address who) internal {
        require(block.timestamp < endStream , "!stream");
        TokenStream storage ts = tokensNotYetStreamed[msg.sender];

        if (block.timestamp >= startTime) {
            // set lastUpdates if need be
            if (ts.lastUpdate == 0) {
                ts.lastUpdate = uint32(block.timestamp);
            }
            if (lastUpdate == 0) {
                lastUpdate = uint32(block.timestamp);
            }

            // accumulate reward per token info
            cumulativeRewardPerToken = rewardPerToken();

            // update user rewards
            ts.rewards = earned(ts, cumulativeRewardPerToken);
            // update users last cumulative reward per token
            ts.lastCumulativeRewardPerToken = cumulativeRewardPerToken;

            // update users unstreamed balance
            uint32 acctTimeDelta = uint32(block.timestamp) - ts.lastUpdate;
            if (acctTimeDelta > 0 && ts.tokens > 0) {
                // some time has passed since this user last interacted
                // update ts not yet streamed
                ts.tokens -= uint112(acctTimeDelta * ts.tokens / (endStream - ts.lastUpdate));
                ts.lastUpdate = uint32(block.timestamp);
            }

            // handle global unstreamed
            uint32 tdelta = uint32(block.timestamp - lastUpdate);
            // stream tokens over
            if (tdelta > 0 && unstreamed > 0) {
                uint256 globalStreamingSpeedPerSecond = (uint256(unstreamed) * 10**6)/ (endStream - lastUpdate);
                unstreamed -= uint112((uint256(tdelta) * globalStreamingSpeedPerSecond) / 10**6);
            }
            // already ensure that blocktimestamp is less than endStream so guaranteed ok here
            lastUpdate = uint32(block.timestamp);
        } else {
            if (ts.lastUpdate == 0) {
                ts.lastUpdate = startTime;
            }
            if (lastUpdate == 0) {
                lastUpdate = startTime;
            }
        }
    }


    function lockInternal() internal {
        require(unlocked == 1, "re");
        unlocked = 2;
    }
    modifier lock {
        lockInternal();
        _;
        unlocked = 1;
    }

    constructor(
        uint64 _streamId,
        address creator,
        bool _isSale,
        address _rewardToken,
        address _depositToken,
        uint32 _startTime,
        uint32 _streamDuration,
        uint32 _depositLockDuration,
        uint32 _rewardLockDuration,
        uint16 _feePercent,
        bool _feeEnabled

    )
        LockeERC20(_depositToken, _streamId, _startTime + _streamDuration)
        ExternallyGoverned(msg.sender) // inherit factory governance
        public 
    {
        // set fee info
        feePercent = _feePercent;
        feeEnabled = _feeEnabled;

        // limit feePercent
        require(feePercent < 10000, "fee");
    
        // store streamParams
        startTime = _startTime;
        streamDuration = _streamDuration;
        depositLockDuration = _depositLockDuration;
        rewardLockDuration = _rewardLockDuration;

        endStream = startTime + streamDuration;
        endDepositLock = endStream + depositLockDuration;
        endRewardLock = endStream + rewardLockDuration;
    
        // set tokens
        depositToken = _depositToken;
        rewardToken = _rewardToken;

        // set streamId
        streamId = _streamId;

        // set sale info
        isSale = _isSale;
    
        streamCreator = creator;

        depositDecimalsOne = uint112(10**ERC20(depositToken).decimals());
    }

    /**
     * @dev Returns relevant internal token amounts
    **/
    function tokenAmounts() public view returns (uint112, uint112, uint112, uint112) {
        return (rewardTokenAmount, depositTokenAmount, rewardTokenFeeAmount, depositTokenFlashloanFeeAmount);
    }

    /**
     * @dev Returns fee parameters
    **/
    function feeParams() public view returns (uint16, bool) {
        return (feePercent, feeEnabled);
    }

    /**
     * @dev Returns stream parameters
    **/
    function streamParams() public view returns (uint32,uint32,uint32,uint32) {
        return (
            startTime,
            streamDuration,
            depositLockDuration,
            rewardLockDuration
        );
    }

    function lastApplicableTime() internal view returns (uint32) {
        return block.timestamp <= endStream ? uint32(block.timestamp) : endStream;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalVirtualBalance == 0) {
            return cumulativeRewardPerToken;
        } else {
            // ∆time*rewardTokensPerSecond*oneDepositToken / totalVirtualBalance
            return cumulativeRewardPerToken + (
                ((uint256(lastApplicableTime()) - lastUpdate) * rewardTokenAmount * depositDecimalsOne/streamDuration) 
                / totalVirtualBalance
            );
        }
    }

    function dilutedBalance(uint112 amount) internal view returns (uint256) {
        // duration / timeRemaining * amount
        if (block.timestamp < startTime) {
            return amount;
        } else {
            uint32 timeRemaining = endStream - uint32(block.timestamp);
            return ((uint256(streamDuration) * amount * 10**6) / timeRemaining) / 10**6;
        }
    }

    function getEarned(address who) public view returns (uint256) {
        TokenStream storage ts = tokensNotYetStreamed[who];
        return earned(ts, rewardPerToken());
    }

    function earned(TokenStream storage ts, uint256 currCumRewardPerToken) internal view returns (uint112) {
        return uint112(ts.virtualBalance * (currCumRewardPerToken - ts.lastCumulativeRewardPerToken) / depositDecimalsOne) + ts.rewards;
    }

    /**
     * @dev Allows _anyone_ to fund this stream, if its before the stream start time
    **/
    function fundStream(uint112 amount) public lock {
        require(amount > 0, "amt");
        require(block.timestamp < startTime, "time");
        uint112 amt;

        // transfer from sender
        uint256 prevBal = ERC20(rewardToken).balanceOf(address(this));
        ERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 newBal = ERC20(rewardToken).balanceOf(address(this));
        require(newBal < type(uint112).max && newBal > prevBal, "erc");

        amount = uint112(newBal - prevBal);
        // if fee is enabled, take a fee
        if (feeEnabled) {
            // Safety:
            //  1. feePercent & y are casted up to u256, so cannot overflow when multiplying
            //  2. downcast is safe because (x*y)/MAX_X is guaranteed to be smaller than y which is uint112
            //  3. amount is guaranteed to be greater than feeAmt
            uint112 feeAmt;
            unchecked {
                feeAmt = uint112(uint256(feePercent) * uint256(amount) / 10000); 
                amt = amount - feeAmt;
            }

            // since this operation can be repeated, we cannot assume no overflow so use checked math
            rewardTokenFeeAmount += feeAmt;
            rewardTokenAmount += amt;
        } else {
            amt = amount;
            rewardTokenAmount += amt;
        }
        
        emit StreamFunded(amt);
    }

    /**
     *  @dev Deposits depositTokens into this stream
     * 
     *  additionally, updates tokensNotYetStreamed
    */ 
    function stake(uint112 amount) public lock updateStream(msg.sender) {
        require(amount > 0, "amt");

        // checked in updateStream
        // require(block.timestamp < endStream, "stake:!stream");

        // transfer tokens over
        uint256 prevBal = ERC20(depositToken).balanceOf(address(this));
        ERC20(depositToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 newBal = ERC20(depositToken).balanceOf(address(this));
        require(newBal <= type(uint112).max && newBal > prevBal, "erc");
        
        uint112 trueDepositAmt = uint112(newBal - prevBal);

        depositTokenAmount += trueDepositAmt;
        TokenStream storage ts = tokensNotYetStreamed[msg.sender];
        ts.tokens += trueDepositAmt;

        uint256 virtualBal = dilutedBalance(trueDepositAmt);
        ts.virtualBalance += virtualBal;
        totalVirtualBalance += virtualBal;
        unstreamed += trueDepositAmt;

        if (!isSale) {
            // not a straight sale, so give the user some receipt tokens
            _mint(msg.sender, trueDepositAmt);
        } else {
        }

        emit Staked(msg.sender, trueDepositAmt);
    }

    /**
     *  @dev Allows a stream depositor to withdraw a specific amount of depositTokens during a stream,
     *  up to their tokensNotYetStreamed amount
     * 
     *  additionally, updates tokensNotYetStreamed
    */ 
    function withdraw(uint112 amount) public lock updateStream(msg.sender) {
        require(amount > 0, "amt");

        // checked in updateStream
        // is the stream still going on? thats the only time a depositer can withdraw
        // require(block.timestamp < endStream, "withdraw:!stream");
        TokenStream storage ts = tokensNotYetStreamed[msg.sender];

        require(ts.tokens >= amount, "amt");
        ts.tokens -= amount;

        uint256 virtualBal = dilutedBalance(amount);
        ts.virtualBalance -= virtualBal;
        totalVirtualBalance -= virtualBal;
        depositTokenAmount -= amount;
        if (!isSale) {
            _burn(msg.sender, amount);
        } else {
        }

        // do the transfer
        ERC20(depositToken).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     *  @dev Allows a stream depositor to exit their entire remaining tokens that haven't streamed
     *  and burns receiptTokens if its not a sale.
     * 
     *  additionally, updates tokensNotYetStreamed. Lock is done in withdraw
    */ 
    function exit() public updateStream(msg.sender) {
        // checked in updateStream
        // is the stream still going on? thats the only time a depositer can withdraw
        // require(block.timestamp < endStream, "withdraw:!stream");
        TokenStream storage ts = tokensNotYetStreamed[msg.sender];
        uint112 amount = ts.tokens;
        withdraw(amount);
    }

    /**
     *  @dev Allows anyone to incentivize this stream with extra tokens
     *  and requires the incentive to not be the reward or deposit token
    */ 
    function createIncentive(address token, uint112 amount) public lock {
        require(token != rewardToken && token != depositToken, "inc");
        
        uint256 prevBal = ERC20(token).balanceOf(address(this));
        ERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 newBal = ERC20(token).balanceOf(address(this));
        require(newBal <= type(uint112).max && newBal > prevBal, "erc");

        uint112 amt = uint112(newBal - prevBal);
        incentives[token] += amt;
        emit StreamIncentivized(token, amt);
    }

    /**
     *  @dev Allows the stream creator to claim an incentive once the stream is done
    */ 
    function claimIncentive(address token) public lock {
        // creator is claiming
        require(msg.sender == streamCreator, "!creator");
        // stream ended
        require(block.timestamp >= endStream, "stream");
        uint112 amount = incentives[token];
        require(amount > 0, "amt");
        incentives[token] = 0;
        ERC20(token).safeTransfer(msg.sender, amount);
        emit StreamIncentiveClaimed(token, amount);
    }

    /**
     *  @dev Allows a receipt token holder to reclaim deposit tokens if the deposit lock is done & their receiptToken amount
     *  is greater than the requested amount
    */ 
    function claimDepositTokens(uint112 amount) public lock {
        require(!isSale, "sale");
        // NOTE: given that endDepositLock is strictly *after* the last time withdraw or exit is callable
        // we dont need to updateStream(msg.sender)
        require(amount > 0, "amt");

        // is the stream over + the deposit lock period over? thats the only time receiptTokens can be burned for depositTokens after stream is over
        require(block.timestamp > endDepositLock, "lock");

        // burn the receiptTokens
        _burn(msg.sender, amount);

        redeemedDepositTokens += amount;

        // send the receipt token holder back the funds
        ERC20(depositToken).safeTransfer(msg.sender, amount);

        emit DepositTokensReclaimed(msg.sender, amount);
    }

    /**
     *  @dev Allows a receipt token holder (or original depositor in case of a sale) to claim their rewardTokens
    */ 
    function claimReward() public lock {
        require(block.timestamp > endRewardLock, "lock");

        TokenStream storage ts = tokensNotYetStreamed[msg.sender];
        // accumulate reward per token info
        cumulativeRewardPerToken = rewardPerToken();

        // update user rewards
        ts.rewards = earned(ts, cumulativeRewardPerToken);
        // update users last cumulative reward per token
        ts.lastCumulativeRewardPerToken = cumulativeRewardPerToken;

        lastUpdate = lastApplicableTime();

        uint256 rewardAmt = ts.rewards;
        ts.rewards = 0;

        require(rewardAmt > 0, "amt");

        // transfer the tokens
        ERC20(rewardToken).safeTransfer(msg.sender, rewardAmt);

        emit RewardsClaimed(msg.sender, rewardAmt);
    }

    /**
     *  @dev Allows a creator to claim sold tokens if the stream has ended & this contract is a sale
    */ 
    function creatorClaimSoldTokens(address destination) public lock {
        // can only claim when its a sale
        require(isSale, "!sale");

        // only can claim once
        require(!claimedDepositTokens, "claimed");
        // creator is claiming
        require(msg.sender == streamCreator, "!creator");
        // stream ended
        require(block.timestamp >= endStream, "stream");
        
        uint112 amount = depositTokenAmount;
        claimedDepositTokens = true;

        ERC20(depositToken).safeTransfer(destination, amount);

        emit SoldTokensClaimed(destination, amount);
    }

    /**
     *  @dev Allows the governance contract of the factory to select a destination
     *  and transfer fees (in rewardTokens) to that address totaling the total fee amount
    */ 
    function claimFees(address destination) public lock externallyGoverned {
        // Stream is done
        require(block.timestamp >= endStream, "stream");

        // reset fee amount
        uint112 fees = rewardTokenFeeAmount;
        if (fees > 0) {
            rewardTokenFeeAmount = 0;

            // transfer and emit event
            ERC20(rewardToken).safeTransfer(destination, fees);
            emit FeesClaimed(rewardToken, destination, fees);
        }

        fees = depositTokenFlashloanFeeAmount;
        if (fees > 0) {
            depositTokenFlashloanFeeAmount = 0;

            // transfer and emit event
            ERC20(depositToken).safeTransfer(destination, fees);

            emit FeesClaimed(depositToken, destination, fees);
        }
        
    }

    // ======== Non-protocol functions ========

    /**
     *  @dev Allows the stream creator to save tokens
     *  There are some limitations to this:
     *      1. if its deposit token:
     *          - DepositLock is fully done
     *          - There are excess deposit tokens (balance - depositTokenAmount)
     *      2. if its the reward token:
     *          - RewardLock is fully done
     *          - Excess defined as balance - (rewardTokenAmount + rewardTokenFeeAmount)
     *      3. if incentivized:
     *          - excesss defined as bal - incentives[token]
    */ 
    function recoverTokens(address token, address recipient) public lock {
        // NOTE: it is the stream creators responsibility to save
        // tokens on behalf of their users.
        require(msg.sender == streamCreator, "!creator");
        if (token == depositToken) {
            require(block.timestamp > endDepositLock, "time");
            // get the balance of this contract
            // check what isnt claimable by either party
            uint256 excess = ERC20(token).balanceOf(address(this)) - (depositTokenAmount - redeemedDepositTokens);
            // allow saving of the token
            ERC20(token).safeTransfer(recipient, excess);

            emit RecoveredTokens(token, recipient, excess);
            return;
        }
        
        if (token == rewardToken) {
            require(block.timestamp > endRewardLock, "time");
            // check current balance vs internal balance
            //
            // NOTE: if a token rebases, i.e. changes balance out from under us,
            // most of this contract breaks and rugs depositors. this isn't exclusive
            // to this function but this function would in theory allow someone to rug
            // and recover the excess (if it is worth anything)

            // check what isnt claimable by depositors and governance
            uint256 excess = ERC20(token).balanceOf(address(this)) - (rewardTokenAmount + rewardTokenFeeAmount);
            ERC20(token).safeTransfer(recipient, excess);

            emit RecoveredTokens(token, recipient, excess);
            return;
        }

        if (incentives[token] > 0) {
            require(block.timestamp >= endStream, "stream");
            uint256 excess = ERC20(token).balanceOf(address(this)) - incentives[token];
            ERC20(token).safeTransfer(recipient, excess);
            emit RecoveredTokens(token, recipient, excess);
            return;
        }

        // not reward token nor deposit nor incentivized token, free to transfer
        uint256 bal = ERC20(token).balanceOf(address(this));
        ERC20(token).safeTransfer(recipient, bal);
        emit RecoveredTokens(token, recipient, bal);
    }

    /**
     *  @dev Allows anyone to flashloan reward or deposit token for a 10bps fee
    */
    function flashloan(address token, address to, uint112 amount, bytes memory data) public lock {
        require(token == depositToken || token == rewardToken, "erc");

        uint256 preDepositTokenBalance = ERC20(depositToken).balanceOf(address(this));
        uint256 preRewardTokenBalance = ERC20(rewardToken).balanceOf(address(this));

        ERC20(token).safeTransfer(to, amount);

        // the `to` contract should have a public function with the signature:
        // function lockeCall(address initiator, address token, uint256 amount, bytes memory data);
        LockeCallee(to).lockeCall(msg.sender, token, amount, data);

        uint256 postDepositTokenBalance = ERC20(depositToken).balanceOf(address(this));
        uint256 postRewardTokenBalance = ERC20(rewardToken).balanceOf(address(this));

        uint112 feeAmt = amount * 10 / 10000; // 10bps fee

        if (token == depositToken) {
            depositTokenFlashloanFeeAmount += feeAmt;
            require(preDepositTokenBalance + feeAmt <= postDepositTokenBalance, "f1");
            require(preRewardTokenBalance <= postRewardTokenBalance, "f2");
        } else {
            rewardTokenFeeAmount += feeAmt;
            require(preDepositTokenBalance <= postDepositTokenBalance, "f3");
            require(preRewardTokenBalance + feeAmt <= postRewardTokenBalance, "f4");
        }

        emit Flashloaned(token, msg.sender, amount, feeAmt);
    }

    /**
     *  @dev Allows inherited governance contract to call functions on behalf of this contract
     *  This is a potentially dangerous function so to ensure trustlessness, *all* balances
     *  that may matter are guaranteed to not change.
     * 
     *  The primary usecase is for claiming potentially airdrops that may have accrued on behalf of this contract
    */
    function arbitraryCall(address who, bytes memory data) public lock externallyGoverned {
        // cannot have an active incentive for the callee
        require(incentives[who] == 0, "inc");
        // cannot be to deposit token nor reward token
        require(who != depositToken && who != rewardToken, "erc");

        // get token balances
        uint256 preDepositTokenBalance = ERC20(depositToken).balanceOf(address(this));
        uint256 preRewardTokenBalance = ERC20(rewardToken).balanceOf(address(this));

        (bool success, bytes memory _ret) = who.call(data);
        require(success);

        // require no change in balances
        uint256 postDepositTokenBalance = ERC20(depositToken).balanceOf(address(this));
        uint256 postRewardTokenBalance = ERC20(rewardToken).balanceOf(address(this));
        require(preDepositTokenBalance == postDepositTokenBalance && preRewardTokenBalance == postRewardTokenBalance, "erc");
    }
}

contract StreamFactory is Governed {

    // ======= Structs ========
    struct GovernableStreamParams {
        uint32 maxDepositLockDuration;
        uint32 maxRewardLockDuration;
        uint32 maxStreamDuration;
        uint32 minStreamDuration;
    }

    struct GovernableFeeParams {
        uint16 feePercent;
        bool feeEnabled;
    }

    // ======= Storage ========
    GovernableStreamParams public streamParams;
    GovernableFeeParams public feeParams;
    uint64 public currStreamId; 

    uint16 constant MAX_FEE_PERCENT = 500; // 500/10000 == 5%

    // =======  Events  =======
    event StreamCreated(uint256 indexed stream_id, address stream_addr);
    event StreamParametersUpdated(GovernableStreamParams oldParams, GovernableStreamParams newParams);
    event FeeParametersUpdated(GovernableFeeParams oldParams, GovernableFeeParams newParams);

    constructor(address _governor, address _emergency_governor) public Governed(_governor, _emergency_governor) {
        streamParams = GovernableStreamParams({
            maxDepositLockDuration: 52 weeks,
            maxRewardLockDuration: 52 weeks,
            maxStreamDuration: 2 weeks,
            minStreamDuration: 1 hours
        });
    }

    /**
     * @dev Deploys a minimal contract pointing to streaming logic. This contract will also be the token contract
     * for the receipt token. It custodies the depositTokens until depositLockDuration is complete. After
     * lockDuration is completed, the depositTokens can be claimed by the original depositors
     * 
    **/
    function createStream(
        address rewardToken,
        address depositToken,
        uint32 startTime,
        uint32 streamDuration,
        uint32 depositLockDuration,
        uint32 rewardLockDuration,
        bool isSale
    )
        public
        returns (Stream)
    {
        // perform checks

        {
            require(startTime >= block.timestamp, "past");
            require(streamDuration >= streamParams.minStreamDuration && streamDuration <= streamParams.maxStreamDuration, "stream");
            require(depositLockDuration <= streamParams.maxDepositLockDuration, "lock");
            require(rewardLockDuration <= streamParams.maxRewardLockDuration, "reward");
        }
        

        // TODO: figure out sane salt, i.e. streamid + x? streamid guaranteed to be unique
        uint64 that_stream = currStreamId;
        currStreamId += 1;
        bytes32 salt = bytes32(uint256(that_stream));

        Stream stream = new Stream{salt: salt}(
            that_stream,
            msg.sender,
            isSale,
            rewardToken,
            depositToken,
            startTime,
            streamDuration,
            depositLockDuration,
            rewardLockDuration,
            feeParams.feePercent,
            feeParams.feeEnabled
        );

        emit StreamCreated(that_stream, address(stream));

        return stream;
    }

    function updateStreamParams(GovernableStreamParams memory newParams) public governed {
        // DATA VALIDATION:
        //  there is no real concept of "sane" limits here, and if misconfigured its ultimated
        //  not a massive deal so no data validation is done
        GovernableStreamParams memory old = streamParams;
        streamParams = newParams;
        emit StreamParametersUpdated(old, newParams);
    }

    function updateFeeParams(GovernableFeeParams memory newFeeParams) public governed {
        require(newFeeParams.feePercent <= MAX_FEE_PERCENT, "fee");
        GovernableFeeParams memory old = feeParams;
        feeParams = newFeeParams;
        emit FeeParametersUpdated(old, newFeeParams);
    }
}
