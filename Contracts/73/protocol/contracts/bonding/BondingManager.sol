pragma solidity 0.5.11;

import "../ManagerProxyTarget.sol";
import "./IBondingManager.sol";
import "../libraries/SortedDoublyLL.sol";
import "../libraries/MathUtils.sol";
import "../libraries/PreciseMathUtils.sol";
import "./libraries/EarningsPool.sol";
import "./libraries/EarningsPoolLIP36.sol";
import "../token/ILivepeerToken.sol";
import "../token/IMinter.sol";
import "../rounds/IRoundsManager.sol";
import "../snapshots/IMerkleSnapshot.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title BondingManager
 * @notice Manages bonding, transcoder and rewards/fee accounting related operations of the Livepeer protocol
 */
contract BondingManager is ManagerProxyTarget, IBondingManager {
    using SafeMath for uint256;
    using SortedDoublyLL for SortedDoublyLL.Data;
    using EarningsPool for EarningsPool.Data;
    using EarningsPoolLIP36 for EarningsPool.Data;

    // Constants
    // Occurances are replaced at compile time
    // and computed to a single value if possible by the optimizer
    uint256 constant MAX_FUTURE_ROUND = 2**256 - 1;
    uint256 constant MAX_LOOKBACK_ROUNDS = 100;
    // PreciseMathUtils.percPoints(1, 1) / MathUtils.percPoints(1, 1) => (10 ** 27) / 1000000
    uint256 constant RESCALE_FACTOR = 10**21;
    // Address for LIP-77 execution
    address constant LIP_77_ADDRESS = 0xB47D8F87c0113827d44Ad0Bc32D53823C477a89d;
    // Maximum CFF used to check whether to down scale CFF values prior to the LIP-78 round
    uint256 constant LIP_78_MAX_CFF = 10**32;

    // Time between unbonding and possible withdrawl in rounds
    uint64 public unbondingPeriod;
    // DEPRECATED - DO NOT USE
    uint256 public numActiveTranscodersDEPRECATED;
    // Max number of rounds that a caller can claim earnings for at once
    uint256 public maxEarningsClaimsRounds;

    // Represents a transcoder's current state
    struct Transcoder {
        uint256 lastRewardRound; // Last round that the transcoder called reward
        uint256 rewardCut; // % of reward paid to transcoder by a delegator
        uint256 feeShare; // % of fees paid to delegators by transcoder
        uint256 pricePerSegmentDEPRECATED; // DEPRECATED - DO NOT USE
        uint256 pendingRewardCutDEPRECATED; // DEPRECATED - DO NOT USE
        uint256 pendingFeeShareDEPRECATED; // DEPRECATED - DO NOT USE
        uint256 pendingPricePerSegmentDEPRECATED; // DEPRECATED - DO NOT USE
        mapping(uint256 => EarningsPool.Data) earningsPoolPerRound; // Mapping of round => earnings pool for the round
        uint256 lastActiveStakeUpdateRound; // Round for which the stake was last updated while the transcoder is active
        uint256 activationRound; // Round in which the transcoder became active - 0 if inactive
        uint256 deactivationRound; // Round in which the transcoder will become inactive
        uint256 activeCumulativeRewards; // The transcoder's cumulative rewards that are active in the current round
        uint256 cumulativeRewards; // The transcoder's cumulative rewards (earned via the its active staked rewards and its reward cut).
        uint256 cumulativeFees; // The transcoder's cumulative fees (earned via the its active staked rewards and its fee share)
        uint256 lastFeeRound; // Latest round in which the transcoder received fees
    }

    // The various states a transcoder can be in
    enum TranscoderStatus {
        NotRegistered,
        Registered
    }

    // Represents a delegator's current state
    struct Delegator {
        uint256 bondedAmount; // The amount of bonded tokens
        uint256 fees; // The amount of fees collected
        address delegateAddress; // The address delegated to
        uint256 delegatedAmount; // The amount of tokens delegated to the delegator
        uint256 startRound; // The round the delegator transitions to bonded phase and is delegated to someone
        uint256 withdrawRoundDEPRECATED; // DEPRECATED - DO NOT USE
        uint256 lastClaimRound; // The last round during which the delegator claimed its earnings
        uint256 nextUnbondingLockId; // ID for the next unbonding lock created
        mapping(uint256 => UnbondingLock) unbondingLocks; // Mapping of unbonding lock ID => unbonding lock
    }

    // The various states a delegator can be in
    enum DelegatorStatus {
        Pending,
        Bonded,
        Unbonded
    }

    // Represents an amount of tokens that are being unbonded
    struct UnbondingLock {
        uint256 amount; // Amount of tokens being unbonded
        uint256 withdrawRound; // Round at which unbonding period is over and tokens can be withdrawn
    }

    // Keep track of the known transcoders and delegators
    mapping(address => Delegator) private delegators;
    mapping(address => Transcoder) private transcoders;

    // DEPRECATED - DO NOT USE
    // The function getTotalBonded() no longer uses this variable
    // and instead calculates the total bonded value separately
    uint256 private totalBondedDEPRECATED;

    // DEPRECATED - DO NOT USE
    SortedDoublyLL.Data private transcoderPoolDEPRECATED;

    // DEPRECATED - DO NOT USE
    struct ActiveTranscoderSetDEPRECATED {
        address[] transcoders;
        mapping(address => bool) isActive;
        uint256 totalStake;
    }

    // DEPRECATED - DO NOT USE
    mapping(uint256 => ActiveTranscoderSetDEPRECATED) public activeTranscoderSetDEPRECATED;

    // The total active stake (sum of the stake of active set members) for the current round
    uint256 public currentRoundTotalActiveStake;
    // The total active stake (sum of the stake of active set members) for the next round
    uint256 public nextRoundTotalActiveStake;

    // The transcoder pool is used to keep track of the transcoders that are eligible for activation.
    // The pool keeps track of the pending active set in round N and the start of round N + 1 transcoders
    // in the pool are locked into the active set for round N + 1
    SortedDoublyLL.Data private transcoderPoolV2;

    // Flag for whether LIP-77 has been executed
    bool private lip77Executed;

    // Check if sender is TicketBroker
    modifier onlyTicketBroker() {
        _onlyTicketBroker();
        _;
    }

    // Check if sender is RoundsManager
    modifier onlyRoundsManager() {
        _onlyRoundsManager();
        _;
    }

    // Check if sender is Verifier
    modifier onlyVerifier() {
        _onlyVerifier();
        _;
    }

    // Check if current round is initialized
    modifier currentRoundInitialized() {
        _currentRoundInitialized();
        _;
    }

    // Automatically claim earnings from lastClaimRound through the current round
    modifier autoClaimEarnings() {
        _autoClaimEarnings();
        _;
    }

    /**
     * @notice BondingManager constructor. Only invokes constructor of base Manager contract with provided Controller address
     * @dev This constructor will not initialize any state variables besides `controller`. The following setter functions
     * should be used to initialize state variables post-deployment:
     * - setUnbondingPeriod()
     * - setNumActiveTranscoders()
     * - setMaxEarningsClaimsRounds()
     * @param _controller Address of Controller that this contract will be registered with
     */
    constructor(address _controller) public Manager(_controller) {}

    /**
     * @notice Set unbonding period. Only callable by Controller owner
     * @param _unbondingPeriod Rounds between unbonding and possible withdrawal
     */
    function setUnbondingPeriod(uint64 _unbondingPeriod) external onlyControllerOwner {
        unbondingPeriod = _unbondingPeriod;

        emit ParameterUpdate("unbondingPeriod");
    }

    /**
     * @notice Set maximum number of active transcoders. Only callable by Controller owner
     * @param _numActiveTranscoders Number of active transcoders
     */
    function setNumActiveTranscoders(uint256 _numActiveTranscoders) external onlyControllerOwner {
        transcoderPoolV2.setMaxSize(_numActiveTranscoders);

        emit ParameterUpdate("numActiveTranscoders");
    }

    /**
     * @notice Set max number of rounds a caller can claim earnings for at once. Only callable by Controller owner
     * @param _maxEarningsClaimsRounds Max number of rounds a caller can claim earnings for at once
     */
    function setMaxEarningsClaimsRounds(uint256 _maxEarningsClaimsRounds) external onlyControllerOwner {
        maxEarningsClaimsRounds = _maxEarningsClaimsRounds;

        emit ParameterUpdate("maxEarningsClaimsRounds");
    }

    /**
     * @notice Execute LIP-77. Can only be called once by Controller owner
     * @param _bondedAmount The bonded amount for the LIP-77 address
     */
    function executeLIP77(uint256 _bondedAmount) external onlyControllerOwner {
        require(!lip77Executed, "LIP-77 already executed");

        lip77Executed = true;

        delegators[LIP_77_ADDRESS].bondedAmount = _bondedAmount;

        address delegate = delegators[LIP_77_ADDRESS].delegateAddress;

        emit Bond(delegate, delegate, LIP_77_ADDRESS, 0, _bondedAmount);
    }

    /**
     * @notice Sets commission rates as a transcoder and if the caller is not in the transcoder pool tries to add it
     * @dev Percentages are represented as numerators of fractions over MathUtils.PERC_DIVISOR
     * @param _rewardCut % of reward paid to transcoder by a delegator
     * @param _feeShare % of fees paid to delegators by a transcoder
     */
    function transcoder(uint256 _rewardCut, uint256 _feeShare) external {
        transcoderWithHint(_rewardCut, _feeShare, address(0), address(0));
    }

    /**
     * @notice Delegate stake towards a specific address
     * @param _amount The amount of tokens to stake
     * @param _to The address of the transcoder to stake towards
     */
    function bond(uint256 _amount, address _to) external {
        bondWithHint(_amount, _to, address(0), address(0), address(0), address(0));
    }

    /**
     * @notice Unbond an amount of the delegator's bonded stake
     * @param _amount Amount of tokens to unbond
     */
    function unbond(uint256 _amount) external {
        unbondWithHint(_amount, address(0), address(0));
    }

    /**
     * @notice Rebond tokens for an unbonding lock to a delegator's current delegate while a delegator is in the Bonded or Pending status
     * @param _unbondingLockId ID of unbonding lock to rebond with
     */
    function rebond(uint256 _unbondingLockId) external {
        rebondWithHint(_unbondingLockId, address(0), address(0));
    }

    /**
     * @notice Rebond tokens for an unbonding lock to a delegate while a delegator is in the Unbonded status
     * @param _to Address of delegate
     * @param _unbondingLockId ID of unbonding lock to rebond with
     */
    function rebondFromUnbonded(address _to, uint256 _unbondingLockId) external {
        rebondFromUnbondedWithHint(_to, _unbondingLockId, address(0), address(0));
    }

    /**
     * @notice Withdraws tokens for an unbonding lock that has existed through an unbonding period
     * @param _unbondingLockId ID of unbonding lock to withdraw with
     */
    function withdrawStake(uint256 _unbondingLockId) external whenSystemNotPaused currentRoundInitialized {
        Delegator storage del = delegators[msg.sender];
        UnbondingLock storage lock = del.unbondingLocks[_unbondingLockId];

        require(isValidUnbondingLock(msg.sender, _unbondingLockId), "invalid unbonding lock ID");
        require(
            lock.withdrawRound <= roundsManager().currentRound(),
            "withdraw round must be before or equal to the current round"
        );

        uint256 amount = lock.amount;
        uint256 withdrawRound = lock.withdrawRound;
        // Delete unbonding lock
        delete del.unbondingLocks[_unbondingLockId];

        // Tell Minter to transfer stake (LPT) to the delegator
        minter().trustedTransferTokens(msg.sender, amount);

        emit WithdrawStake(msg.sender, _unbondingLockId, amount, withdrawRound);
    }

    /**
     * @notice Withdraws fees to the caller
     */
    function withdrawFees() external whenSystemNotPaused currentRoundInitialized autoClaimEarnings {
        uint256 fees = delegators[msg.sender].fees;
        require(fees > 0, "no fees to withdraw");
        delegators[msg.sender].fees = 0;

        // Tell Minter to transfer fees (ETH) to the delegator
        minter().trustedWithdrawETH(msg.sender, fees);

        emit WithdrawFees(msg.sender);
    }

    /**
     * @notice Mint token rewards for an active transcoder and its delegators
     */
    function reward() external {
        rewardWithHint(address(0), address(0));
    }

    /**
     * @notice Update transcoder's fee pool. Only callable by the TicketBroker
     * @param _transcoder Transcoder address
     * @param _fees Fees to be added to the fee pool
     */
    function updateTranscoderWithFees(
        address _transcoder,
        uint256 _fees,
        uint256 _round
    ) external whenSystemNotPaused onlyTicketBroker {
        // Silence unused param compiler warning
        _round;

        require(isRegisteredTranscoder(_transcoder), "transcoder must be registered");

        uint256 currentRound = roundsManager().currentRound();

        Transcoder storage t = transcoders[_transcoder];

        uint256 lastRewardRound = t.lastRewardRound;
        uint256 activeCumulativeRewards = t.activeCumulativeRewards;

        // LIP-36: Add fees for the current round instead of '_round'
        // https://github.com/livepeer/LIPs/issues/35#issuecomment-673659199
        EarningsPool.Data storage earningsPool = t.earningsPoolPerRound[currentRound];
        EarningsPool.Data memory prevEarningsPool = latestCumulativeFactorsPool(t, currentRound.sub(1));

        // if transcoder hasn't called 'reward()' for '_round' its 'transcoderFeeShare', 'transcoderRewardCut' and 'totalStake'
        // on the 'EarningsPool' for '_round' would not be initialized and the fee distribution wouldn't happen as expected
        // for cumulative fee calculation this would result in division by zero.
        if (currentRound > lastRewardRound) {
            earningsPool.setCommission(t.rewardCut, t.feeShare);

            uint256 lastUpdateRound = t.lastActiveStakeUpdateRound;
            if (lastUpdateRound < currentRound) {
                earningsPool.setStake(t.earningsPoolPerRound[lastUpdateRound].totalStake);
            }

            // If reward() has not been called yet in the current round, then the transcoder's activeCumulativeRewards has not
            // yet been set in for the round. When the transcoder calls reward() its activeCumulativeRewards will be set to its
            // current cumulativeRewards. So, we can just use the transcoder's cumulativeRewards here because this will become
            // the transcoder's activeCumulativeRewards if it calls reward() later on in the current round
            activeCumulativeRewards = t.cumulativeRewards;
        }

        uint256 totalStake = earningsPool.totalStake;
        if (prevEarningsPool.cumulativeRewardFactor == 0 && lastRewardRound == currentRound) {
            // if transcoder called reward for 'currentRound' but not for 'currentRound - 1' (missed reward call)
            // retroactively calculate what its cumulativeRewardFactor would have been for 'currentRound - 1' (cfr. previous lastRewardRound for transcoder)
            // based on rewards for currentRound
            IMinter mtr = minter();
            uint256 rewards = PreciseMathUtils.percOf(
                mtr.currentMintableTokens().add(mtr.currentMintedTokens()),
                totalStake,
                currentRoundTotalActiveStake
            );
            uint256 transcoderCommissionRewards = MathUtils.percOf(rewards, earningsPool.transcoderRewardCut);
            uint256 delegatorsRewards = rewards.sub(transcoderCommissionRewards);

            prevEarningsPool.cumulativeRewardFactor = PreciseMathUtils.percOf(
                earningsPool.cumulativeRewardFactor,
                totalStake,
                delegatorsRewards.add(totalStake)
            );
        }

        // If the previous cumulativeRewardFactor is 0 and the current round is before the LIP-71 round, set the default value to
        // MathUtils.percPoints(1, 1) because we only set the default value to PreciseMathUtils.percPoints(1, 1) when storing for
        // the LIP-71 round and onwards (see updateCumulativeFeeFactor() in EarningsPoolLIP36.sol)
        if (prevEarningsPool.cumulativeRewardFactor == 0 && currentRound < roundsManager().lipUpgradeRound(71)) {
            prevEarningsPool.cumulativeRewardFactor = MathUtils.percPoints(1, 1);
        }

        uint256 delegatorsFees = MathUtils.percOf(_fees, earningsPool.transcoderFeeShare);
        uint256 transcoderCommissionFees = _fees.sub(delegatorsFees);
        // Calculate the fees earned by the transcoder's earned rewards
        uint256 transcoderRewardStakeFees = PreciseMathUtils.percOf(
            delegatorsFees,
            activeCumulativeRewards,
            totalStake
        );
        // Track fees earned by the transcoder based on its earned rewards and feeShare
        t.cumulativeFees = t.cumulativeFees.add(transcoderRewardStakeFees).add(transcoderCommissionFees);
        // Update cumulative fee factor with new fees
        // The cumulativeFeeFactor is used to calculate fees for all delegators including the transcoder (self-delegated)
        // Note that delegatorsFees includes transcoderRewardStakeFees, but no delegator will claim that amount using
        // the earnings claiming algorithm and instead that amount is accounted for in the transcoder's cumulativeFees field
        earningsPool.updateCumulativeFeeFactor(prevEarningsPool, delegatorsFees);

        t.lastFeeRound = currentRound;
    }

    /**
     * @notice Slash a transcoder. Only callable by the Verifier
     * @param _transcoder Transcoder address
     * @param _finder Finder that proved a transcoder violated a slashing condition. Null address if there is no finder
     * @param _slashAmount Percentage of transcoder bond to be slashed
     * @param _finderFee Percentage of penalty awarded to finder. Zero if there is no finder
     */
    function slashTranscoder(
        address _transcoder,
        address _finder,
        uint256 _slashAmount,
        uint256 _finderFee
    ) external whenSystemNotPaused onlyVerifier {
        Delegator storage del = delegators[_transcoder];

        if (del.bondedAmount > 0) {
            uint256 penalty = MathUtils.percOf(delegators[_transcoder].bondedAmount, _slashAmount);

            // If active transcoder, resign it
            if (transcoderPoolV2.contains(_transcoder)) {
                resignTranscoder(_transcoder);
            }

            // Decrease bonded stake
            del.bondedAmount = del.bondedAmount.sub(penalty);

            // If still bonded decrease delegate's delegated amount
            if (delegatorStatus(_transcoder) == DelegatorStatus.Bonded) {
                delegators[del.delegateAddress].delegatedAmount = delegators[del.delegateAddress].delegatedAmount.sub(
                    penalty
                );
            }

            // Account for penalty
            uint256 burnAmount = penalty;

            // Award finder fee if there is a finder address
            if (_finder != address(0)) {
                uint256 finderAmount = MathUtils.percOf(penalty, _finderFee);
                minter().trustedTransferTokens(_finder, finderAmount);

                // Minter burns the slashed funds - finder reward
                minter().trustedBurnTokens(burnAmount.sub(finderAmount));

                emit TranscoderSlashed(_transcoder, _finder, penalty, finderAmount);
            } else {
                // Minter burns the slashed funds
                minter().trustedBurnTokens(burnAmount);

                emit TranscoderSlashed(_transcoder, address(0), penalty, 0);
            }
        } else {
            emit TranscoderSlashed(_transcoder, _finder, 0, 0);
        }
    }

    /**
     * @notice Claim token pools shares for a delegator from its lastClaimRound through the end round
     * @param _endRound The last round for which to claim token pools shares for a delegator
     */
    function claimEarnings(uint256 _endRound) external whenSystemNotPaused currentRoundInitialized {
        uint256 lastClaimRound = delegators[msg.sender].lastClaimRound;
        require(lastClaimRound < _endRound, "end round must be after last claim round");
        // _endRound should be equal to the current round because after LIP-36 using a past _endRound can result
        // in incorrect cumulative factor values used/stored for the _endRound in updateDelegatorWithEarnings().
        // The exception is when claiming through an _endRound before the LIP-36 upgrade round because cumulative factor
        // values will not be used/stored in updateDelegatorWithEarnings() before the LIP-36 upgrade round.
        require(
            _endRound == roundsManager().currentRound() || _endRound < roundsManager().lipUpgradeRound(36),
            "end round must be equal to the current round or before the LIP-36 upgrade round"
        );

        updateDelegatorWithEarnings(msg.sender, _endRound, lastClaimRound);
    }

    /**
     * @notice Claim earnings for a delegator based on the snapshot taken in LIP-52
     * @dev https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-52.md
     * @param _pendingStake the amount of pending stake for the delegator (current stake + pending rewards)
     * @param _pendingFees the amount of pending fees for the delegator (current fees + pending fees)
     * @param _earningsProof array of keccak256 sibling hashes on the branch of the leaf for the delegator up to the root
     * @param _data (optional) raw transaction data to be executed on behalf of msg.sender after claiming snapshot earnings
     */
    function claimSnapshotEarnings(
        uint256 _pendingStake,
        uint256 _pendingFees,
        bytes32[] calldata _earningsProof,
        bytes calldata _data
    ) external whenSystemNotPaused currentRoundInitialized {
        Delegator storage del = delegators[msg.sender];

        uint256 lip52Round = roundsManager().lipUpgradeRound(52);

        uint256 lastClaimRound = del.lastClaimRound;

        require(lastClaimRound < lip52Round, "Already claimed for LIP-52");

        bytes32 leaf = keccak256(abi.encode(msg.sender, _pendingStake, _pendingFees));

        require(
            IMerkleSnapshot(controller.getContract(keccak256("MerkleSnapshot"))).verify(
                keccak256("LIP-52"),
                _earningsProof,
                leaf
            ),
            "Merkle proof is invalid"
        );

        emit EarningsClaimed(
            del.delegateAddress,
            msg.sender,
            _pendingStake.sub(del.bondedAmount),
            _pendingFees.sub(del.fees),
            lastClaimRound.add(1),
            lip52Round
        );

        del.lastClaimRound = lip52Round;
        del.bondedAmount = _pendingStake;
        del.fees = _pendingFees;

        // allow for execution of subsequent claiming or staking operations
        if (_data.length > 0) {
            (bool success, bytes memory returnData) = address(this).delegatecall(_data);
            require(success, string(returnData));
        }
    }

    /**
     * @notice Called during round initialization to set the total active stake for the round. Only callable by the RoundsManager
     */
    function setCurrentRoundTotalActiveStake() external onlyRoundsManager {
        currentRoundTotalActiveStake = nextRoundTotalActiveStake;
    }

    /**
     * @notice Sets commission rates as a transcoder and if the caller is not in the transcoder pool tries to add it using an optional list hint
     * @dev Percentages are represented as numerators of fractions over MathUtils.PERC_DIVISOR. If the caller is going to be added to the pool, the
     * caller can provide an optional hint for the insertion position in the pool via the `_newPosPrev` and `_newPosNext` params. A linear search will
     * be executed starting at the hint to find the correct position - in the best case, the hint is the correct position so no search is executed.
     * See SortedDoublyLL.sol for details on list hints
     * @param _rewardCut % of reward paid to transcoder by a delegator
     * @param _feeShare % of fees paid to delegators by a transcoder
     * @param _newPosPrev Address of previous transcoder in pool if the caller joins the pool
     * @param _newPosNext Address of next transcoder in pool if the caller joins the pool
     */
    function transcoderWithHint(
        uint256 _rewardCut,
        uint256 _feeShare,
        address _newPosPrev,
        address _newPosNext
    ) public whenSystemNotPaused currentRoundInitialized {
        require(!roundsManager().currentRoundLocked(), "can't update transcoder params, current round is locked");
        require(MathUtils.validPerc(_rewardCut), "invalid rewardCut percentage");
        require(MathUtils.validPerc(_feeShare), "invalid feeShare percentage");
        require(isRegisteredTranscoder(msg.sender), "transcoder must be registered");

        Transcoder storage t = transcoders[msg.sender];
        uint256 currentRound = roundsManager().currentRound();

        require(
            !isActiveTranscoder(msg.sender) || t.lastRewardRound == currentRound,
            "caller can't be active or must have already called reward for the current round"
        );

        t.rewardCut = _rewardCut;
        t.feeShare = _feeShare;

        if (!transcoderPoolV2.contains(msg.sender)) {
            tryToJoinActiveSet(
                msg.sender,
                delegators[msg.sender].delegatedAmount,
                currentRound.add(1),
                _newPosPrev,
                _newPosNext
            );
        }

        emit TranscoderUpdate(msg.sender, _rewardCut, _feeShare);
    }

    /**
     * @notice Delegate stake towards a specific address and updates the transcoder pool using optional list hints if needed
     * @dev If the caller is decreasing the stake of its old delegate in the transcoder pool, the caller can provide an optional hint
     * for the insertion position of the old delegate via the `_oldDelegateNewPosPrev` and `_oldDelegateNewPosNext` params.
     * If the caller is delegating to a delegate that is in the transcoder pool, the caller can provide an optional hint for the
     * insertion position of the delegate via the `_currDelegateNewPosPrev` and `_currDelegateNewPosNext` params.
     * In both cases, a linear search will be executed starting at the hint to find the correct position. In the best case, the hint
     * is the correct position so no search is executed. See SortedDoublyLL.sol for details on list hints
     * @param _amount The amount of tokens to stake.
     * @param _to The address of the transcoder to stake towards
     * @param _oldDelegateNewPosPrev The address of the previous transcoder in the pool for the old delegate
     * @param _oldDelegateNewPosNext The address of the next transcoder in the pool for the old delegate
     * @param _currDelegateNewPosPrev The address of the previous transcoder in the pool for the current delegate
     * @param _currDelegateNewPosNext The address of the next transcoder in the pool for the current delegate
     */
    function bondWithHint(
        uint256 _amount,
        address _to,
        address _oldDelegateNewPosPrev,
        address _oldDelegateNewPosNext,
        address _currDelegateNewPosPrev,
        address _currDelegateNewPosNext
    ) public whenSystemNotPaused currentRoundInitialized autoClaimEarnings {
        Delegator storage del = delegators[msg.sender];

        uint256 currentRound = roundsManager().currentRound();
        // Amount to delegate
        uint256 delegationAmount = _amount;
        // Current delegate
        address currentDelegate = del.delegateAddress;

        if (delegatorStatus(msg.sender) == DelegatorStatus.Unbonded) {
            // New delegate
            // Set start round
            // Don't set start round if delegator is in pending state because the start round would not change
            del.startRound = currentRound.add(1);
            // Unbonded state = no existing delegate and no bonded stake
            // Thus, delegation amount = provided amount
        } else if (currentDelegate != address(0) && currentDelegate != _to) {
            // A registered transcoder cannot delegate its bonded stake toward another address
            // because it can only be delegated toward itself
            // In the future, if delegation towards another registered transcoder as an already
            // registered transcoder becomes useful (i.e. for transitive delegation), this restriction
            // could be removed
            require(
                !isRegisteredTranscoder(msg.sender),
                "registered transcoders can't delegate towards other addresses"
            );
            // Changing delegate
            // Set start round
            del.startRound = currentRound.add(1);
            // Update amount to delegate with previous delegation amount
            delegationAmount = delegationAmount.add(del.bondedAmount);

            decreaseTotalStake(currentDelegate, del.bondedAmount, _oldDelegateNewPosPrev, _oldDelegateNewPosNext);
        }

        Transcoder storage newDelegate = transcoders[_to];
        EarningsPool.Data storage currPool = newDelegate.earningsPoolPerRound[currentRound];
        if (currPool.cumulativeRewardFactor == 0) {
            currPool.cumulativeRewardFactor = cumulativeFactorsPool(newDelegate, newDelegate.lastRewardRound)
                .cumulativeRewardFactor;
        }
        if (currPool.cumulativeFeeFactor == 0) {
            currPool.cumulativeFeeFactor = cumulativeFactorsPool(newDelegate, newDelegate.lastFeeRound)
                .cumulativeFeeFactor;
        }

        // cannot delegate to someone without having bonded stake
        require(delegationAmount > 0, "delegation amount must be greater than 0");
        // Update delegate
        del.delegateAddress = _to;
        // Update bonded amount
        del.bondedAmount = del.bondedAmount.add(_amount);

        increaseTotalStake(_to, delegationAmount, _currDelegateNewPosPrev, _currDelegateNewPosNext);

        if (_amount > 0) {
            // Transfer the LPT to the Minter
            livepeerToken().transferFrom(msg.sender, address(minter()), _amount);
        }

        emit Bond(_to, currentDelegate, msg.sender, _amount, del.bondedAmount);
    }

    /**
     * @notice Unbond an amount of the delegator's bonded stake and updates the transcoder pool using an optional list hint if needed
     * @dev If the caller remains in the transcoder pool, the caller can provide an optional hint for its insertion position in the
     * pool via the `_newPosPrev` and `_newPosNext` params. A linear search will be executed starting at the hint to find the correct position.
     * In the best case, the hint is the correct position so no search is executed. See SortedDoublyLL.sol details on list hints
     * @param _amount Amount of tokens to unbond
     * @param _newPosPrev Address of previous transcoder in pool if the caller remains in the pool
     * @param _newPosNext Address of next transcoder in pool if the caller remains in the pool
     */
    function unbondWithHint(
        uint256 _amount,
        address _newPosPrev,
        address _newPosNext
    ) public whenSystemNotPaused currentRoundInitialized autoClaimEarnings {
        require(delegatorStatus(msg.sender) == DelegatorStatus.Bonded, "caller must be bonded");

        Delegator storage del = delegators[msg.sender];

        require(_amount > 0, "unbond amount must be greater than 0");
        require(_amount <= del.bondedAmount, "amount is greater than bonded amount");

        address currentDelegate = del.delegateAddress;
        uint256 currentRound = roundsManager().currentRound();
        uint256 withdrawRound = currentRound.add(unbondingPeriod);
        uint256 unbondingLockId = del.nextUnbondingLockId;

        // Create new unbonding lock
        del.unbondingLocks[unbondingLockId] = UnbondingLock({ amount: _amount, withdrawRound: withdrawRound });
        // Increment ID for next unbonding lock
        del.nextUnbondingLockId = unbondingLockId.add(1);
        // Decrease delegator's bonded amount
        del.bondedAmount = del.bondedAmount.sub(_amount);

        if (del.bondedAmount == 0) {
            // Delegator no longer delegated to anyone if it does not have a bonded amount
            del.delegateAddress = address(0);
            // Delegator does not have a start round if it is no longer delegated to anyone
            del.startRound = 0;

            if (transcoderPoolV2.contains(msg.sender)) {
                resignTranscoder(msg.sender);
            }
        }

        // If msg.sender was resigned this statement will only decrease delegators[currentDelegate].delegatedAmount
        decreaseTotalStake(currentDelegate, _amount, _newPosPrev, _newPosNext);

        emit Unbond(currentDelegate, msg.sender, unbondingLockId, _amount, withdrawRound);
    }

    /**
     * @notice Rebond tokens for an unbonding lock to a delegator's current delegate while a delegator is in the Bonded or Pending status and updates
     * the transcoder pool using an optional list hint if needed
     * @dev If the delegate is in the transcoder pool, the caller can provide an optional hint for the delegate's insertion position in the
     * pool via the `_newPosPrev` and `_newPosNext` params. A linear search will be executed starting at the hint to find the correct position.
     * In the best case, the hint is the correct position so no search is executed. See SortedDoublyLL.sol details on list hints
     * @param _unbondingLockId ID of unbonding lock to rebond with
     * @param _newPosPrev Address of previous transcoder in pool if the delegate is in the pool
     * @param _newPosNext Address of next transcoder in pool if the delegate is in the pool
     */
    function rebondWithHint(
        uint256 _unbondingLockId,
        address _newPosPrev,
        address _newPosNext
    ) public whenSystemNotPaused currentRoundInitialized autoClaimEarnings {
        require(delegatorStatus(msg.sender) != DelegatorStatus.Unbonded, "caller must be bonded");

        // Process rebond using unbonding lock
        processRebond(msg.sender, _unbondingLockId, _newPosPrev, _newPosNext);
    }

    /**
     * @notice Rebond tokens for an unbonding lock to a delegate while a delegator is in the Unbonded status and updates the transcoder pool using
     * an optional list hint if needed
     * @dev If the delegate joins the transcoder pool, the caller can provide an optional hint for the delegate's insertion position in the
     * pool via the `_newPosPrev` and `_newPosNext` params. A linear search will be executed starting at the hint to find the correct position.
     * In the best case, the hint is the correct position so no search is executed. See SortedDoublyLL.sol for details on list hints
     * @param _to Address of delegate
     * @param _unbondingLockId ID of unbonding lock to rebond with
     * @param _newPosPrev Address of previous transcoder in pool if the delegate joins the pool
     * @param _newPosNext Address of next transcoder in pool if the delegate joins the pool
     */
    function rebondFromUnbondedWithHint(
        address _to,
        uint256 _unbondingLockId,
        address _newPosPrev,
        address _newPosNext
    ) public whenSystemNotPaused currentRoundInitialized autoClaimEarnings {
        require(delegatorStatus(msg.sender) == DelegatorStatus.Unbonded, "caller must be unbonded");

        // Set delegator's start round and transition into Pending state
        delegators[msg.sender].startRound = roundsManager().currentRound().add(1);
        // Set delegator's delegate
        delegators[msg.sender].delegateAddress = _to;
        // Process rebond using unbonding lock
        processRebond(msg.sender, _unbondingLockId, _newPosPrev, _newPosNext);
    }

    /**
     * @notice Mint token rewards for an active transcoder and its delegators and update the transcoder pool using an optional list hint if needed
     * @dev If the caller is in the transcoder pool, the caller can provide an optional hint for its insertion position in the
     * pool via the `_newPosPrev` and `_newPosNext` params. A linear search will be executed starting at the hint to find the correct position.
     * In the best case, the hint is the correct position so no search is executed. See SortedDoublyLL.sol for details on list hints
     * @param _newPosPrev Address of previous transcoder in pool if the caller is in the pool
     * @param _newPosNext Address of next transcoder in pool if the caller is in the pool
     */
    function rewardWithHint(address _newPosPrev, address _newPosNext)
        public
        whenSystemNotPaused
        currentRoundInitialized
    {
        uint256 currentRound = roundsManager().currentRound();

        require(isActiveTranscoder(msg.sender), "caller must be an active transcoder");
        require(
            transcoders[msg.sender].lastRewardRound != currentRound,
            "caller has already called reward for the current round"
        );

        Transcoder storage t = transcoders[msg.sender];
        EarningsPool.Data storage earningsPool = t.earningsPoolPerRound[currentRound];

        // Set last round that transcoder called reward
        earningsPool.setCommission(t.rewardCut, t.feeShare);

        // If transcoder didn't receive stake updates during the previous round and hasn't called reward for > 1 round
        // the 'totalStake' on its 'EarningsPool' for the current round wouldn't be initialized
        // Thus we sync the the transcoder's stake to when it was last updated
        // 'updateTrancoderWithRewards()' will set the update round to 'currentRound +1' so this synchronization shouldn't occur frequently
        uint256 lastUpdateRound = t.lastActiveStakeUpdateRound;
        if (lastUpdateRound < currentRound) {
            earningsPool.setStake(t.earningsPoolPerRound[lastUpdateRound].totalStake);
        }

        // Create reward based on active transcoder's stake relative to the total active stake
        // rewardTokens = (current mintable tokens for the round * active transcoder stake) / total active stake
        uint256 rewardTokens = minter().createReward(earningsPool.totalStake, currentRoundTotalActiveStake);

        updateTranscoderWithRewards(msg.sender, rewardTokens, currentRound, _newPosPrev, _newPosNext);

        // Set last round that transcoder called reward
        t.lastRewardRound = currentRound;

        emit Reward(msg.sender, rewardTokens);
    }

    /**
     * @notice Returns pending bonded stake for a delegator from its lastClaimRound through an end round
     * @param _delegator Address of delegator
     * @param _endRound The last round to compute pending stake from
     * @return Pending bonded stake for '_delegator' since last claiming rewards
     */
    function pendingStake(address _delegator, uint256 _endRound) public view returns (uint256) {
        // _endRound should be equal to the current round because after LIP-36 using a past _endRound can result
        // in incorrect cumulative factor values used for the _endRound in pendingStakeAndFees().
        // The exception is when calculating stake through an _endRound before the LIP-36 upgrade round because cumulative factor
        // values will not be used in pendingStakeAndFees() before the LIP-36 upgrade round.
        uint256 endRound = _endRound;
        if (endRound >= roundsManager().lipUpgradeRound(36)) {
            endRound = roundsManager().currentRound();
        }

        (uint256 stake, ) = pendingStakeAndFees(_delegator, endRound);
        return stake;
    }

    /**
     * @notice Returns pending fees for a delegator from its lastClaimRound through an end round
     * @param _delegator Address of delegator
     * @param _endRound The last round to compute pending fees from
     * @return Pending fees for '_delegator' since last claiming fees
     */
    function pendingFees(address _delegator, uint256 _endRound) public view returns (uint256) {
        // _endRound should be equal to the current round because after LIP-36 using a past _endRound can result
        // in incorrect cumulative factor values used for the _endRound in pendingStakeAndFees().
        // The exception is when calculating fees through an _endRound before the LIP-36 upgrade round because cumulative factor
        // values will not be used in pendingStakeAndFees() before the LIP-36 upgrade round.
        uint256 endRound = _endRound;
        if (endRound >= roundsManager().lipUpgradeRound(36)) {
            endRound = roundsManager().currentRound();
        }

        (, uint256 fees) = pendingStakeAndFees(_delegator, endRound);
        return fees;
    }

    /**
     * @notice Returns total bonded stake for a transcoder
     * @param _transcoder Address of transcoder
     * @return total bonded stake for a delegator
     */
    function transcoderTotalStake(address _transcoder) public view returns (uint256) {
        return delegators[_transcoder].delegatedAmount;
    }

    /**
     * @notice Computes transcoder status
     * @param _transcoder Address of transcoder
     * @return registered or not registered transcoder status
     */
    function transcoderStatus(address _transcoder) public view returns (TranscoderStatus) {
        if (isRegisteredTranscoder(_transcoder)) return TranscoderStatus.Registered;
        return TranscoderStatus.NotRegistered;
    }

    /**
     * @notice Computes delegator status
     * @param _delegator Address of delegator
     * @return bonded, unbonded or pending delegator status
     */
    function delegatorStatus(address _delegator) public view returns (DelegatorStatus) {
        Delegator storage del = delegators[_delegator];

        if (del.bondedAmount == 0) {
            // Delegator unbonded all its tokens
            return DelegatorStatus.Unbonded;
        } else if (del.startRound > roundsManager().currentRound()) {
            // Delegator round start is in the future
            return DelegatorStatus.Pending;
        } else {
            // Delegator round start is now or in the past
            // del.startRound != 0 here because if del.startRound = 0 then del.bondedAmount = 0 which
            // would trigger the first if clause
            return DelegatorStatus.Bonded;
        }
    }

    /**
     * @notice Return transcoder information
     * @param _transcoder Address of transcoder
     * @return lastRewardRound Trancoder's last reward round
     * @return rewardCut Transcoder's reward cut
     * @return feeShare Transcoder's fee share
     * @return lastActiveStakeUpdateRound Round in which transcoder's stake was last updated while active
     * @return activationRound Round in which transcoder became active
     * @return deactivationRound Round in which transcoder will no longer be active
     * @return activeCumulativeRewards Transcoder's cumulative rewards that are currently active
     * @return cumulativeRewards Transcoder's cumulative rewards (earned via its active staked rewards and its reward cut)
     * @return cumulativeFees Transcoder's cumulative fees (earned via its active staked rewards and its fee share)
     * @return lastFeeRound Latest round that the transcoder received fees
     */
    function getTranscoder(address _transcoder)
        public
        view
        returns (
            uint256 lastRewardRound,
            uint256 rewardCut,
            uint256 feeShare,
            uint256 lastActiveStakeUpdateRound,
            uint256 activationRound,
            uint256 deactivationRound,
            uint256 activeCumulativeRewards,
            uint256 cumulativeRewards,
            uint256 cumulativeFees,
            uint256 lastFeeRound
        )
    {
        Transcoder storage t = transcoders[_transcoder];

        lastRewardRound = t.lastRewardRound;
        rewardCut = t.rewardCut;
        feeShare = t.feeShare;
        lastActiveStakeUpdateRound = t.lastActiveStakeUpdateRound;
        activationRound = t.activationRound;
        deactivationRound = t.deactivationRound;
        activeCumulativeRewards = t.activeCumulativeRewards;
        cumulativeRewards = t.cumulativeRewards;
        cumulativeFees = t.cumulativeFees;
        lastFeeRound = t.lastFeeRound;
    }

    /**
     * @notice Return transcoder's earnings pool for a given round
     * @param _transcoder Address of transcoder
     * @param _round Round number
     * @return rewardPool Reward pool for delegators (only used before LIP-36)
     * @return feePool Fee pool for delegators (only used before LIP-36)
     * @return totalStake Transcoder's total stake in '_round'
     * @return claimableStake Remaining stake that can be used to claim from the pool (only used before LIP-36)
     * @return transcoderRewardCut Transcoder's reward cut for '_round'
     * @return transcoderFeeShare Transcoder's fee share for '_round'
     * @return transcoderRewardPool Transcoder's rewards for '_round' (only used before LIP-36)
     * @return transcoderFeePool Transcoder's fees for '_round' (only used before LIP-36)
     * @return hasTranscoderRewardFeePool True if there is a split reward/fee pool for the transcoder (only used before LIP-36)
     * @return cumulativeRewardFactor The cumulative reward factor for delegator rewards calculation (only used after LIP-36)
     * @return cumulativeFeeFactor The cumulative fee factor for delegator fees calculation (only used after LIP-36)
     */
    function getTranscoderEarningsPoolForRound(address _transcoder, uint256 _round)
        public
        view
        returns (
            uint256 rewardPool,
            uint256 feePool,
            uint256 totalStake,
            uint256 claimableStake,
            uint256 transcoderRewardCut,
            uint256 transcoderFeeShare,
            uint256 transcoderRewardPool,
            uint256 transcoderFeePool,
            bool hasTranscoderRewardFeePool,
            uint256 cumulativeRewardFactor,
            uint256 cumulativeFeeFactor
        )
    {
        EarningsPool.Data storage earningsPool = transcoders[_transcoder].earningsPoolPerRound[_round];

        rewardPool = earningsPool.rewardPool;
        feePool = earningsPool.feePool;
        totalStake = earningsPool.totalStake;
        claimableStake = earningsPool.claimableStake;
        transcoderRewardCut = earningsPool.transcoderRewardCut;
        transcoderFeeShare = earningsPool.transcoderFeeShare;
        transcoderRewardPool = earningsPool.transcoderRewardPool;
        transcoderFeePool = earningsPool.transcoderFeePool;
        hasTranscoderRewardFeePool = earningsPool.hasTranscoderRewardFeePool;
        cumulativeRewardFactor = earningsPool.cumulativeRewardFactor;
        cumulativeFeeFactor = earningsPool.cumulativeFeeFactor;
    }

    /**
     * @notice Return delegator info
     * @param _delegator Address of delegator
     * @return total amount bonded by '_delegator'
     * @return amount of fees collected by '_delegator'
     * @return address '_delegator' has bonded to
     * @return total amount delegated to '_delegator'
     * @return round in which bond for '_delegator' became effective
     * @return round for which '_delegator' has last claimed earnings
     * @return ID for the next unbonding lock created for '_delegator'
     */
    function getDelegator(address _delegator)
        public
        view
        returns (
            uint256 bondedAmount,
            uint256 fees,
            address delegateAddress,
            uint256 delegatedAmount,
            uint256 startRound,
            uint256 lastClaimRound,
            uint256 nextUnbondingLockId
        )
    {
        Delegator storage del = delegators[_delegator];

        bondedAmount = del.bondedAmount;
        fees = del.fees;
        delegateAddress = del.delegateAddress;
        delegatedAmount = del.delegatedAmount;
        startRound = del.startRound;
        lastClaimRound = del.lastClaimRound;
        nextUnbondingLockId = del.nextUnbondingLockId;
    }

    /**
     * @notice Return delegator's unbonding lock info
     * @param _delegator Address of delegator
     * @param _unbondingLockId ID of unbonding lock
     * @return amount of stake locked up by unbonding lock
     * @return round in which 'amount' becomes available for withdrawal
     */
    function getDelegatorUnbondingLock(address _delegator, uint256 _unbondingLockId)
        public
        view
        returns (uint256 amount, uint256 withdrawRound)
    {
        UnbondingLock storage lock = delegators[_delegator].unbondingLocks[_unbondingLockId];

        return (lock.amount, lock.withdrawRound);
    }

    /**
     * @notice Returns max size of transcoder pool
     * @return transcoder pool max size
     */
    function getTranscoderPoolMaxSize() public view returns (uint256) {
        return transcoderPoolV2.getMaxSize();
    }

    /**
     * @notice Returns size of transcoder pool
     * @return transcoder pool current size
     */
    function getTranscoderPoolSize() public view returns (uint256) {
        return transcoderPoolV2.getSize();
    }

    /**
     * @notice Returns transcoder with most stake in pool
     * @return address for transcoder with highest stake in transcoder pool
     */
    function getFirstTranscoderInPool() public view returns (address) {
        return transcoderPoolV2.getFirst();
    }

    /**
     * @notice Returns next transcoder in pool for a given transcoder
     * @param _transcoder Address of a transcoder in the pool
     * @return address for the transcoder after '_transcoder' in transcoder pool
     */
    function getNextTranscoderInPool(address _transcoder) public view returns (address) {
        return transcoderPoolV2.getNext(_transcoder);
    }

    /**
     * @notice Return total bonded tokens
     * @return total active stake for the current round
     */
    function getTotalBonded() public view returns (uint256) {
        return currentRoundTotalActiveStake;
    }

    /**
     * @notice Return whether a transcoder is active for the current round
     * @param _transcoder Transcoder address
     * @return true if transcoder is active
     */
    function isActiveTranscoder(address _transcoder) public view returns (bool) {
        Transcoder storage t = transcoders[_transcoder];
        uint256 currentRound = roundsManager().currentRound();
        return t.activationRound <= currentRound && currentRound < t.deactivationRound;
    }

    /**
     * @notice Return whether a transcoder is registered
     * @param _transcoder Transcoder address
     * @return true if transcoder is self-bonded
     */
    function isRegisteredTranscoder(address _transcoder) public view returns (bool) {
        Delegator storage d = delegators[_transcoder];
        return d.delegateAddress == _transcoder && d.bondedAmount > 0;
    }

    /**
     * @notice Return whether an unbonding lock for a delegator is valid
     * @param _delegator Address of delegator
     * @param _unbondingLockId ID of unbonding lock
     * @return true if unbondingLock for ID has a non-zero withdraw round
     */
    function isValidUnbondingLock(address _delegator, uint256 _unbondingLockId) public view returns (bool) {
        // A unbonding lock is only valid if it has a non-zero withdraw round (the default value is zero)
        return delegators[_delegator].unbondingLocks[_unbondingLockId].withdrawRound > 0;
    }

    /**
     * @notice Return an EarningsPool.Data struct with cumulative factors for a given round that are rescaled if needed
     * @param _transcoder Storage pointer to a transcoder struct
     * @param _round The round to fetch the cumulative factors for
     */
    function cumulativeFactorsPool(Transcoder storage _transcoder, uint256 _round)
        internal
        view
        returns (EarningsPool.Data memory pool)
    {
        pool.cumulativeRewardFactor = _transcoder.earningsPoolPerRound[_round].cumulativeRewardFactor;
        pool.cumulativeFeeFactor = _transcoder.earningsPoolPerRound[_round].cumulativeFeeFactor;

        uint256 lip71Round = roundsManager().lipUpgradeRound(71);
        // If we are at or after the LIP-71 round then all cumulative factor values should be scaled using PreciseMathUtils.percPoints(1, 1)
        // If a cumulative factor was stored before the LIP-71 round it will still be scaled using MathUtils.percPoints(1, 1)
        // So, once we are at or after the LIP-71 round, if we read a cumulative factor for a round before the LIP-71 round, we rescale
        // the value by RESCALE_FACTOR so that the end value is scaled by PreciseMathUtils.percPoints(1, 1)
        if (roundsManager().currentRound() >= lip71Round) {
            if (_round < lip71Round) {
                pool.cumulativeRewardFactor = pool.cumulativeRewardFactor.mul(RESCALE_FACTOR);
                pool.cumulativeFeeFactor = pool.cumulativeFeeFactor.mul(RESCALE_FACTOR);
            } else {
                // There was a bug in bondWithHint() that allowed cumulative factors to be stored after LIP-71 round to still be scaled using MathUtils.percPoints(1, 1)
                // If we read a cumulativeRewardFactor for a round after the LIP-71 round and it is less than PreciseMathUtils.percPoints(1, 1), it was
                // affected by this bug so we rescale it by RESCALE_FACTOR
                if (pool.cumulativeRewardFactor < PreciseMathUtils.percPoints(1, 1)) {
                    pool.cumulativeRewardFactor = pool.cumulativeRewardFactor.mul(RESCALE_FACTOR);
                }

                if (_round <= roundsManager().lipUpgradeRound(78)) {
                    if (
                        // As of the LIP-78 round, the only post LIP-71 round CFF values that are below MathUtils.percPoints(1, 1)
                        // are CFF values that were copied from pre LIP-71 round without multiplying by RESCALE_FACTOR due to a bug.
                        pool.cumulativeFeeFactor < MathUtils.percPoints(1, 1)
                    ) {
                        // At this point, we know that the CFF was copied from pre LIP-71 round without multiplying by RESCALE_FACTOR due to a bug.
                        // Correct this by multiplying by RESCALE_FACTOR.
                        pool.cumulativeFeeFactor = pool.cumulativeFeeFactor.mul(RESCALE_FACTOR);
                    } else if (
                        // As of the LIP-78 round, the only CFF values > 10 ** 32 are ones that were corrupted due to a bug
                        // that caused CFF values to be multiplied by RESCALE_FACTOR unnecessarily.
                        pool.cumulativeFeeFactor > LIP_78_MAX_CFF
                    ) {
                        // At this point, we know that the CFF was multiplied by RESCALE_FACTOR unnecessarily.
                        // Correct this by dividing by RESCALE_FACTOR.
                        pool.cumulativeFeeFactor = pool.cumulativeFeeFactor.div(RESCALE_FACTOR);
                    }
                }
            }
        }

        return pool;
    }

    /**
     * @notice Return an EarningsPool.Data struct with the latest cumulative factors for a given round
     * @param _transcoder Storage pointer to a transcoder struct
     * @param _round The round to fetch the latest cumulative factors for
     * @return pool An EarningsPool.Data populated with the latest cumulative factors for _round
     */
    function latestCumulativeFactorsPool(Transcoder storage _transcoder, uint256 _round)
        internal
        view
        returns (EarningsPool.Data memory pool)
    {
        pool = cumulativeFactorsPool(_transcoder, _round);

        uint256 lastRewardRound = _transcoder.lastRewardRound;
        // Only use the cumulativeRewardFactor for lastRewardRound if lastRewardRound is before _round
        if (pool.cumulativeRewardFactor == 0 && lastRewardRound < _round) {
            pool.cumulativeRewardFactor = cumulativeFactorsPool(_transcoder, lastRewardRound).cumulativeRewardFactor;
        }

        uint256 lastFeeRound = _transcoder.lastFeeRound;
        // Only use the cumulativeFeeFactor for lastFeeRound if lastFeeRound is before _round
        if (pool.cumulativeFeeFactor == 0 && lastFeeRound < _round) {
            pool.cumulativeFeeFactor = cumulativeFactorsPool(_transcoder, lastFeeRound).cumulativeFeeFactor;
        }

        return pool;
    }

    /**
     * @notice Return a delegator's cumulative stake and fees using the LIP-36 earnings claiming algorithm
     * @param _transcoder Storage pointer to a transcoder struct for a delegator's delegate
     * @param _startRound The round for the start cumulative factors
     * @param _endRound The round for the end cumulative factors
     * @param _stake The delegator's initial stake before including earned rewards
     * @param _fees The delegator's initial fees before including earned fees
     * @return (cStake, cFees) where cStake is the delegator's cumulative stake including earned rewards and cFees is the delegator's cumulative fees including earned fees
     */
    function delegatorCumulativeStakeAndFees(
        Transcoder storage _transcoder,
        uint256 _startRound,
        uint256 _endRound,
        uint256 _stake,
        uint256 _fees
    ) internal view returns (uint256 cStake, uint256 cFees) {
        // Fetch start cumulative factors
        EarningsPool.Data memory startPool = cumulativeFactorsPool(_transcoder, _startRound);

        // We can lookback for a cumulativeRewardFactor if the start cumulativeRewardFactor is 0
        // Do not lookback if the latest cumulativeRewardFactor is 0 because that indicates that the factor was never > 0 for the transcoder in the past
        bool lookbackCumulativeRewardFactor = _transcoder
            .earningsPoolPerRound[_transcoder.lastRewardRound]
            .cumulativeRewardFactor >
            0 &&
            startPool.cumulativeRewardFactor == 0;
        // We can lookback for a cumulativeFeeFactor if the start cumulativeFeeFactor is 0
        // Do not lookback if the latest cumulativeFeeFactor is 0 because that indicates that the factor was never > 0 for the transcoder in the past
        bool lookbackCumulativeFeeFactor = _transcoder
            .earningsPoolPerRound[_transcoder.lastFeeRound]
            .cumulativeFeeFactor >
            0 &&
            startPool.cumulativeFeeFactor == 0;
        // The lookback loop will only be needed for a few accounts delegated to transcoders before the update that ensures start factors are always initialized
        // If we need a cumulativeRewardFactor OR cumulativeFeeFactor lookback up to min(MAX_LOOKBACK_ROUNDS, _startRound) # of rounds
        uint256 lip36Round = roundsManager().lipUpgradeRound(36);
        for (
            uint256 lookback = 1;
            lookback <= MAX_LOOKBACK_ROUNDS &&
                lookback <= _startRound &&
                (lookbackCumulativeRewardFactor || lookbackCumulativeFeeFactor);
            lookback++
        ) {
            uint256 lookbackRound = _startRound.sub(lookback);
            // Cannot lookback past the LIP-36 upgrade round
            if (lookbackRound < lip36Round) {
                break;
            }

            EarningsPool.Data storage pool = _transcoder.earningsPoolPerRound[lookbackRound];
            // Short-circuit in the following conditionals by running the boolean check before the storage check
            if (lookbackCumulativeRewardFactor && pool.cumulativeRewardFactor > 0) {
                startPool.cumulativeRewardFactor = cumulativeFactorsPool(_transcoder, lookbackRound)
                    .cumulativeRewardFactor;
                lookbackCumulativeRewardFactor = false;
            }
            if (lookbackCumulativeFeeFactor && pool.cumulativeFeeFactor > 0) {
                startPool.cumulativeFeeFactor = cumulativeFactorsPool(_transcoder, lookbackRound).cumulativeFeeFactor;
                lookbackCumulativeFeeFactor = false;
            }
        }

        // If the start cumulativeRewardFactor is 0 and we are before the LIP-71 round, set the default value to
        // MathUtils.percPoints(1, 1) because we only set the default value to PreciseMathUtils.percPoints(1, 1) from LIP-71 round
        // and onward
        if (startPool.cumulativeRewardFactor == 0) {
            startPool.cumulativeRewardFactor = roundsManager().currentRound() < roundsManager().lipUpgradeRound(71)
                ? MathUtils.percPoints(1, 1)
                : PreciseMathUtils.percPoints(1, 1);
        }

        // Fetch end cumulative factors
        EarningsPool.Data memory endPool = latestCumulativeFactorsPool(_transcoder, _endRound);

        // If the end cumulativeRewardFactor is 0 and we are before the LIP-71 round, set the default value to
        // MathUtils.percPoints(1, 1) because we only set the default value to PreciseMathUtils.percPoints(1, 1) from LIP-71 round
        // and onward
        if (endPool.cumulativeRewardFactor == 0) {
            endPool.cumulativeRewardFactor = roundsManager().currentRound() < roundsManager().lipUpgradeRound(71)
                ? MathUtils.percPoints(1, 1)
                : PreciseMathUtils.percPoints(1, 1);
        }

        cFees = _fees.add(
            PreciseMathUtils.percOf(
                _stake,
                endPool.cumulativeFeeFactor.sub(startPool.cumulativeFeeFactor),
                startPool.cumulativeRewardFactor
            )
        );

        cStake = PreciseMathUtils.percOf(_stake, endPool.cumulativeRewardFactor, startPool.cumulativeRewardFactor);

        return (cStake, cFees);
    }

    /**
     * @notice Return the pending stake and fees for a delegator
     * @param _delegator Address of a delegator
     * @param _endRound The last round to claim earnings for when calculating the pending stake and fees
     * @return (stake, fees) where stake is the delegator's pending stake and fees is the delegator's pending fees
     */
    function pendingStakeAndFees(address _delegator, uint256 _endRound)
        internal
        view
        returns (uint256 stake, uint256 fees)
    {
        Delegator storage del = delegators[_delegator];
        Transcoder storage t = transcoders[del.delegateAddress];

        fees = del.fees;
        stake = del.bondedAmount;

        uint256 startRound = del.lastClaimRound.add(1);
        address delegateAddr = del.delegateAddress;
        bool isTranscoder = _delegator == delegateAddr;

        uint256 lip36Round = roundsManager().lipUpgradeRound(36);
        while (startRound <= _endRound && startRound <= lip36Round) {
            EarningsPool.Data storage earningsPool = t.earningsPoolPerRound[startRound];

            // If earningsPool.hasTranscoderRewardFeePool is not set during lip36Round then the transcoder did not call
            // reward during lip36Round before the upgrade. In this case, if the transcoder calls reward in lip36Round
            // the delegator can use the LIP-36 earnings claiming algorithm to claim for lip36Round
            if (startRound == lip36Round && !earningsPool.hasTranscoderRewardFeePool) {
                break;
            }

            if (earningsPool.hasClaimableShares()) {
                // Calculate and add fee pool share from this round
                fees = fees.add(earningsPool.feePoolShare(stake, isTranscoder));
                // Calculate new bonded amount with rewards from this round. Updated bonded amount used
                // to calculate fee pool share in next round
                stake = stake.add(earningsPool.rewardPoolShare(stake, isTranscoder));
            }

            startRound = startRound.add(1);
        }

        // If the transcoder called reward during lip36Round the upgrade, then startRound = lip36Round
        // Otherwise, startRound = lip36Round + 1

        // If the start round is greater than the end round, we've already claimed for the end round so we do not
        // need to execute the LIP-36 earnings claiming algorithm. This could be the case if:
        // - _endRound < lip36Round i.e. we are not claiming through the lip36Round
        // - _endRound == lip36Round AND startRound = lip36Round + 1 i.e we already claimed through the lip36Round

        // The LIP-36 earnings claiming algorithm uses the cumulative factors from the delegator's lastClaimRound i.e. startRound - 1
        // and from the specified _endRound
        // We only need to execute this algorithm if the end round >= lip36Round
        if (_endRound >= lip36Round) {
            // Make sure there is a round to claim i.e. end round - (start round - 1) > 0
            if (startRound <= _endRound) {
                (stake, fees) = delegatorCumulativeStakeAndFees(t, startRound.sub(1), _endRound, stake, fees);
            }
            // cumulativeRewards and cumulativeFees will track *all* rewards/fees earned by the transcoder
            // so it is important that this is only executed with the end round as the current round or else
            // the returned stake and fees will reflect rewards/fees earned in the future relative to the end round
            if (isTranscoder) {
                stake = stake.add(t.cumulativeRewards);
                fees = fees.add(t.cumulativeFees);
            }
        }

        return (stake, fees);
    }

    /**
     * @dev Increase the total stake for a delegate and updates its 'lastActiveStakeUpdateRound'
     * @param _delegate The delegate to increase the stake for
     * @param _amount The amount to increase the stake for '_delegate' by
     */
    function increaseTotalStake(
        address _delegate,
        uint256 _amount,
        address _newPosPrev,
        address _newPosNext
    ) internal {
        if (isRegisteredTranscoder(_delegate)) {
            uint256 currStake = transcoderTotalStake(_delegate);
            uint256 newStake = currStake.add(_amount);
            uint256 currRound = roundsManager().currentRound();
            uint256 nextRound = currRound.add(1);

            // If the transcoder is already in the active set update its stake and return
            if (transcoderPoolV2.contains(_delegate)) {
                transcoderPoolV2.updateKey(_delegate, newStake, _newPosPrev, _newPosNext);
                nextRoundTotalActiveStake = nextRoundTotalActiveStake.add(_amount);
                Transcoder storage t = transcoders[_delegate];

                // currStake (the transcoder's delegatedAmount field) will reflect the transcoder's stake from lastActiveStakeUpdateRound
                // because it is updated every time lastActiveStakeUpdateRound is updated
                // The current active total stake is set to currStake to ensure that the value can be used in updateTranscoderWithRewards()
                // and updateTranscoderWithFees() when lastActiveStakeUpdateRound > currentRound
                if (t.lastActiveStakeUpdateRound < currRound) {
                    t.earningsPoolPerRound[currRound].setStake(currStake);
                }

                t.earningsPoolPerRound[nextRound].setStake(newStake);
                t.lastActiveStakeUpdateRound = nextRound;
            } else {
                // Check if the transcoder is eligible to join the active set in the update round
                tryToJoinActiveSet(_delegate, newStake, nextRound, _newPosPrev, _newPosNext);
            }
        }

        // Increase delegate's delegated amount
        delegators[_delegate].delegatedAmount = delegators[_delegate].delegatedAmount.add(_amount);
    }

    /**
     * @dev Decrease the total stake for a delegate and updates its 'lastActiveStakeUpdateRound'
     * @param _delegate The transcoder to decrease the stake for
     * @param _amount The amount to decrease the stake for '_delegate' by
     */
    function decreaseTotalStake(
        address _delegate,
        uint256 _amount,
        address _newPosPrev,
        address _newPosNext
    ) internal {
        if (transcoderPoolV2.contains(_delegate)) {
            uint256 currStake = transcoderTotalStake(_delegate);
            uint256 newStake = currStake.sub(_amount);
            uint256 currRound = roundsManager().currentRound();
            uint256 nextRound = currRound.add(1);

            transcoderPoolV2.updateKey(_delegate, newStake, _newPosPrev, _newPosNext);
            nextRoundTotalActiveStake = nextRoundTotalActiveStake.sub(_amount);
            Transcoder storage t = transcoders[_delegate];

            // currStake (the transcoder's delegatedAmount field) will reflect the transcoder's stake from lastActiveStakeUpdateRound
            // because it is updated every time lastActiveStakeUpdateRound is updated
            // The current active total stake is set to currStake to ensure that the value can be used in updateTranscoderWithRewards()
            // and updateTranscoderWithFees() when lastActiveStakeUpdateRound > currentRound
            if (t.lastActiveStakeUpdateRound < currRound) {
                t.earningsPoolPerRound[currRound].setStake(currStake);
            }

            t.lastActiveStakeUpdateRound = nextRound;
            t.earningsPoolPerRound[nextRound].setStake(newStake);
        }

        // Decrease old delegate's delegated amount
        delegators[_delegate].delegatedAmount = delegators[_delegate].delegatedAmount.sub(_amount);
    }

    /**
     * @dev Tries to add a transcoder to active transcoder pool, evicts the active transcoder with the lowest stake if the pool is full
     * @param _transcoder The transcoder to insert into the transcoder pool
     * @param _totalStake The total stake for '_transcoder'
     * @param _activationRound The round in which the transcoder should become active
     */
    function tryToJoinActiveSet(
        address _transcoder,
        uint256 _totalStake,
        uint256 _activationRound,
        address _newPosPrev,
        address _newPosNext
    ) internal {
        uint256 pendingNextRoundTotalActiveStake = nextRoundTotalActiveStake;

        if (transcoderPoolV2.isFull()) {
            address lastTranscoder = transcoderPoolV2.getLast();
            uint256 lastStake = transcoderTotalStake(lastTranscoder);

            // If the pool is full and the transcoder has less stake than the least stake transcoder in the pool
            // then the transcoder is unable to join the active set for the next round
            if (_totalStake <= lastStake) {
                return;
            }

            // Evict the least stake transcoder from the active set for the next round
            // Not zeroing 'Transcoder.lastActiveStakeUpdateRound' saves gas (5k when transcoder is evicted and 20k when transcoder is reinserted)
            // There should be no side-effects as long as the value is properly updated on stake updates
            // Not zeroing the stake on the current round's 'EarningsPool' saves gas and should have no side effects as long as
            // 'EarningsPool.setStake()' is called whenever a transcoder becomes active again.
            transcoderPoolV2.remove(lastTranscoder);
            transcoders[lastTranscoder].deactivationRound = _activationRound;
            pendingNextRoundTotalActiveStake = pendingNextRoundTotalActiveStake.sub(lastStake);

            emit TranscoderDeactivated(lastTranscoder, _activationRound);
        }

        transcoderPoolV2.insert(_transcoder, _totalStake, _newPosPrev, _newPosNext);
        pendingNextRoundTotalActiveStake = pendingNextRoundTotalActiveStake.add(_totalStake);
        Transcoder storage t = transcoders[_transcoder];
        t.lastActiveStakeUpdateRound = _activationRound;
        t.activationRound = _activationRound;
        t.deactivationRound = MAX_FUTURE_ROUND;
        t.earningsPoolPerRound[_activationRound].setStake(_totalStake);
        nextRoundTotalActiveStake = pendingNextRoundTotalActiveStake;
        emit TranscoderActivated(_transcoder, _activationRound);
    }

    /**
     * @dev Remove a transcoder from the pool and deactivate it
     */
    function resignTranscoder(address _transcoder) internal {
        // Not zeroing 'Transcoder.lastActiveStakeUpdateRound' saves gas (5k when transcoder is evicted and 20k when transcoder is reinserted)
        // There should be no side-effects as long as the value is properly updated on stake updates
        // Not zeroing the stake on the current round's 'EarningsPool' saves gas and should have no side effects as long as
        // 'EarningsPool.setStake()' is called whenever a transcoder becomes active again.
        transcoderPoolV2.remove(_transcoder);
        nextRoundTotalActiveStake = nextRoundTotalActiveStake.sub(transcoderTotalStake(_transcoder));
        uint256 deactivationRound = roundsManager().currentRound().add(1);
        transcoders[_transcoder].deactivationRound = deactivationRound;
        emit TranscoderDeactivated(_transcoder, deactivationRound);
    }

    /**
     * @dev Update a transcoder with rewards and update the transcoder pool with an optional list hint if needed.
     * See SortedDoublyLL.sol for details on list hints
     * @param _transcoder Address of transcoder
     * @param _rewards Amount of rewards
     * @param _round Round that transcoder is updated
     * @param _newPosPrev Address of previous transcoder in pool if the transcoder is in the pool
     * @param _newPosNext Address of next transcoder in pool if the transcoder is in the pool
     */
    function updateTranscoderWithRewards(
        address _transcoder,
        uint256 _rewards,
        uint256 _round,
        address _newPosPrev,
        address _newPosNext
    ) internal {
        Transcoder storage t = transcoders[_transcoder];
        EarningsPool.Data storage earningsPool = t.earningsPoolPerRound[_round];
        EarningsPool.Data memory prevEarningsPool = cumulativeFactorsPool(t, t.lastRewardRound);

        // If the previous cumulativeRewardFactor is 0 and we are before the LIP-71 round, set the default value to
        // MathUtils.percPoints(1, 1) because we only set the default value to PreciseMathUtils.percPoints(1, 1) when storing for
        // the LIP-71 round and onwards (see updateCumulativeRewardFactor() in EarningsPoolLIP36.sol)
        if (prevEarningsPool.cumulativeRewardFactor == 0 && _round < roundsManager().lipUpgradeRound(71)) {
            prevEarningsPool.cumulativeRewardFactor = MathUtils.percPoints(1, 1);
        }

        t.activeCumulativeRewards = t.cumulativeRewards;

        uint256 transcoderCommissionRewards = MathUtils.percOf(_rewards, earningsPool.transcoderRewardCut);
        uint256 delegatorsRewards = _rewards.sub(transcoderCommissionRewards);
        // Calculate the rewards earned by the transcoder's earned rewards
        uint256 transcoderRewardStakeRewards = PreciseMathUtils.percOf(
            delegatorsRewards,
            t.activeCumulativeRewards,
            earningsPool.totalStake
        );
        // Track rewards earned by the transcoder based on its earned rewards and rewardCut
        t.cumulativeRewards = t.cumulativeRewards.add(transcoderRewardStakeRewards).add(transcoderCommissionRewards);
        // Update cumulative reward factor with new rewards
        // The cumulativeRewardFactor is used to calculate rewards for all delegators including the transcoder (self-delegated)
        // Note that delegatorsRewards includes transcoderRewardStakeRewards, but no delegator will claim that amount using
        // the earnings claiming algorithm and instead that amount is accounted for in the transcoder's cumulativeRewards field
        earningsPool.updateCumulativeRewardFactor(prevEarningsPool, delegatorsRewards);
        // Update transcoder's total stake with rewards
        increaseTotalStake(_transcoder, _rewards, _newPosPrev, _newPosNext);
    }

    /**
     * @dev Update a delegator with token pools shares from its lastClaimRound through a given round
     * @param _delegator Delegator address
     * @param _endRound The last round for which to update a delegator's stake with earnings pool shares
     * @param _lastClaimRound The round for which a delegator has last claimed earnings
     */
    function updateDelegatorWithEarnings(
        address _delegator,
        uint256 _endRound,
        uint256 _lastClaimRound
    ) internal {
        Delegator storage del = delegators[_delegator];
        uint256 startRound = _lastClaimRound.add(1);
        uint256 currentBondedAmount = del.bondedAmount;
        uint256 currentFees = del.fees;

        uint256 lip36Round = roundsManager().lipUpgradeRound(36);

        // Only will have earnings to claim if you have a delegate
        // If not delegated, skip the earnings claim process
        if (del.delegateAddress != address(0)) {
            if (startRound <= lip36Round) {
                // Cannot claim earnings for more than maxEarningsClaimsRounds before LIP-36
                // This is a number to cause transactions to fail early if
                // we know they will require too much gas to loop through all the necessary rounds to claim earnings
                // The user should instead manually invoke `claimEarnings` to split up the claiming process
                // across multiple transactions
                uint256 endLoopRound = _endRound <= lip36Round ? _endRound : lip36Round;
                require(
                    endLoopRound.sub(_lastClaimRound) <= maxEarningsClaimsRounds,
                    "too many rounds to claim through"
                );
            }

            (currentBondedAmount, currentFees) = pendingStakeAndFees(_delegator, _endRound);

            // Only execute cumulative factor logic after LIP-36 upgrade round
            // After LIP-36 upgrade round the following code block should only be executed if _endRound is the current round
            // See claimEarnings() and autoClaimEarnings()
            if (_endRound >= lip36Round) {
                // Check whether the endEarningsPool is initialised
                // If it is not initialised set it's cumulative factors so that they can be used when a delegator
                // next claims earnings as the start cumulative factors (see delegatorCumulativeStakeAndFees())
                Transcoder storage t = transcoders[del.delegateAddress];
                EarningsPool.Data storage endEarningsPool = t.earningsPoolPerRound[_endRound];
                if (endEarningsPool.cumulativeRewardFactor == 0) {
                    uint256 lastRewardRound = t.lastRewardRound;
                    if (lastRewardRound < _endRound) {
                        endEarningsPool.cumulativeRewardFactor = cumulativeFactorsPool(t, lastRewardRound)
                            .cumulativeRewardFactor;
                    }
                }
                if (endEarningsPool.cumulativeFeeFactor == 0) {
                    uint256 lastFeeRound = t.lastFeeRound;
                    if (lastFeeRound < _endRound) {
                        endEarningsPool.cumulativeFeeFactor = cumulativeFactorsPool(t, lastFeeRound)
                            .cumulativeFeeFactor;
                    }
                }

                if (del.delegateAddress == _delegator) {
                    t.cumulativeFees = 0;
                    t.cumulativeRewards = 0;
                    // activeCumulativeRewards is not cleared here because the next reward() call will set it to cumulativeRewards
                }
            }
        }

        emit EarningsClaimed(
            del.delegateAddress,
            _delegator,
            currentBondedAmount.sub(del.bondedAmount),
            currentFees.sub(del.fees),
            startRound,
            _endRound
        );

        del.lastClaimRound = _endRound;
        // Rewards are bonded by default
        del.bondedAmount = currentBondedAmount;
        del.fees = currentFees;
    }

    /**
     * @dev Update the state of a delegator and its delegate by processing a rebond using an unbonding lock and update the transcoder pool with an optional
     * list hint if needed. See SortedDoublyLL.sol for details on list hints
     * @param _delegator Address of delegator
     * @param _unbondingLockId ID of unbonding lock to rebond with
     * @param _newPosPrev Address of previous transcoder in pool if the delegate is already in or joins the pool
     * @param _newPosNext Address of next transcoder in pool if the delegate is already in or joins the pool
     */
    function processRebond(
        address _delegator,
        uint256 _unbondingLockId,
        address _newPosPrev,
        address _newPosNext
    ) internal {
        Delegator storage del = delegators[_delegator];
        UnbondingLock storage lock = del.unbondingLocks[_unbondingLockId];

        require(isValidUnbondingLock(_delegator, _unbondingLockId), "invalid unbonding lock ID");

        uint256 amount = lock.amount;
        // Increase delegator's bonded amount
        del.bondedAmount = del.bondedAmount.add(amount);

        // Delete lock
        delete del.unbondingLocks[_unbondingLockId];

        increaseTotalStake(del.delegateAddress, amount, _newPosPrev, _newPosNext);

        emit Rebond(del.delegateAddress, _delegator, _unbondingLockId, amount);
    }

    /**
     * @dev Return LivepeerToken interface
     * @return Livepeer token contract registered with Controller
     */
    function livepeerToken() internal view returns (ILivepeerToken) {
        return ILivepeerToken(controller.getContract(keccak256("LivepeerToken")));
    }

    /**
     * @dev Return Minter interface
     * @return Minter contract registered with Controller
     */
    function minter() internal view returns (IMinter) {
        return IMinter(controller.getContract(keccak256("Minter")));
    }

    /**
     * @dev Return RoundsManager interface
     * @return RoundsManager contract registered with Controller
     */
    function roundsManager() internal view returns (IRoundsManager) {
        return IRoundsManager(controller.getContract(keccak256("RoundsManager")));
    }

    function _onlyTicketBroker() internal view {
        require(msg.sender == controller.getContract(keccak256("TicketBroker")), "caller must be TicketBroker");
    }

    function _onlyRoundsManager() internal view {
        require(msg.sender == controller.getContract(keccak256("RoundsManager")), "caller must be RoundsManager");
    }

    function _onlyVerifier() internal view {
        require(msg.sender == controller.getContract(keccak256("Verifier")), "caller must be Verifier");
    }

    function _currentRoundInitialized() internal view {
        require(roundsManager().currentRoundInitialized(), "current round is not initialized");
    }

    function _autoClaimEarnings() internal {
        uint256 currentRound = roundsManager().currentRound();
        uint256 lastClaimRound = delegators[msg.sender].lastClaimRound;
        if (lastClaimRound < currentRound) {
            updateDelegatorWithEarnings(msg.sender, currentRound, lastClaimRound);
        }
    }
}
