pragma solidity 0.5.11;

import "../ManagerProxyTarget.sol";
import "./IRoundsManager.sol";
import "../bonding/IBondingManager.sol";
import "../token/IMinter.sol";
import "../libraries/MathUtils.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title RoundsManager
 * @notice Manages round progression and other blockchain time related operations of the Livepeer protocol
 */
contract RoundsManager is ManagerProxyTarget, IRoundsManager {
    using SafeMath for uint256;

    // Round length in blocks
    uint256 public roundLength;
    // Lock period of a round as a % of round length
    // Transcoders cannot join the transcoder pool or change their rates during the lock period at the end of a round
    // The lock period provides delegators time to review transcoder information without changes
    // # of blocks in the lock period = (roundLength * roundLockAmount) / PERC_DIVISOR
    uint256 public roundLockAmount;
    // Last initialized round. After first round, this is the last round during which initializeRound() was called
    uint256 public lastInitializedRound;
    // Round in which roundLength was last updated
    uint256 public lastRoundLengthUpdateRound;
    // Start block of the round in which roundLength was last updated
    uint256 public lastRoundLengthUpdateStartBlock;

    // Mapping round number => block hash for the round
    mapping(uint256 => bytes32) internal _blockHashForRound;

    // LIP Upgrade Rounds
    // These can be used in conditionals to ensure backwards compatibility or skip such backwards compatibility logic
    // in case 'currentRound' > LIP-X upgrade round
    mapping(uint256 => uint256) public lipUpgradeRound; // mapping (LIP-number > round number)

    /**
     * @notice RoundsManager constructor. Only invokes constructor of base Manager contract with provided Controller address
     * @dev This constructor will not initialize any state variables besides `controller`. The following setter functions
     * should be used to initialize state variables post-deployment:
     * - setRoundLength()
     * - setRoundLockAmount()
     * @param _controller Address of Controller that this contract will be registered with
     */
    constructor(address _controller) public Manager(_controller) {}

    /**
     * @notice Set round length. Only callable by the controller owner
     * @param _roundLength Round length in blocks
     */
    function setRoundLength(uint256 _roundLength) external onlyControllerOwner {
        require(_roundLength > 0, "round length cannot be 0");

        if (roundLength == 0) {
            // If first time initializing roundLength, set roundLength before
            // lastRoundLengthUpdateRound and lastRoundLengthUpdateStartBlock
            roundLength = _roundLength;
            lastRoundLengthUpdateRound = currentRound();
            lastRoundLengthUpdateStartBlock = currentRoundStartBlock();
        } else {
            // If updating roundLength, set roundLength after
            // lastRoundLengthUpdateRound and lastRoundLengthUpdateStartBlock
            lastRoundLengthUpdateRound = currentRound();
            lastRoundLengthUpdateStartBlock = currentRoundStartBlock();
            roundLength = _roundLength;
        }

        emit ParameterUpdate("roundLength");
    }

    /**
     * @notice Set round lock amount. Only callable by the controller owner
     * @param _roundLockAmount Round lock amount as a % of the number of blocks in a round
     */
    function setRoundLockAmount(uint256 _roundLockAmount) external onlyControllerOwner {
        require(MathUtils.validPerc(_roundLockAmount), "round lock amount must be a valid percentage");

        roundLockAmount = _roundLockAmount;

        emit ParameterUpdate("roundLockAmount");
    }

    /**
     * @notice Initialize the current round. Called once at the start of any round
     */
    function initializeRound() external whenSystemNotPaused {
        uint256 currRound = currentRound();

        uint256 lip73Round = lipUpgradeRound[73];
        require(lip73Round == 0 || currRound < lip73Round, "cannot initialize past LIP-73 round");

        // Check if already called for the current round
        require(lastInitializedRound < currRound, "round already initialized");

        // Set current round as initialized
        lastInitializedRound = currRound;
        // Store block hash for round
        bytes32 roundBlockHash = blockHash(blockNum().sub(1));
        _blockHashForRound[currRound] = roundBlockHash;
        // Set total active stake for the round
        bondingManager().setCurrentRoundTotalActiveStake();
        // Set mintable rewards for the round
        minter().setCurrentRewardTokens();

        emit NewRound(currRound, roundBlockHash);
    }

    /**
     * @notice setLIPUpgradeRound sets the round an LIP upgrade would become active.
     * @param _lip the LIP number.
     * @param _round (optional) the round in which the LIP becomes active
     */
    function setLIPUpgradeRound(uint256 _lip, uint256 _round) external onlyControllerOwner {
        require(lipUpgradeRound[_lip] == 0, "LIP upgrade round already set");
        lipUpgradeRound[_lip] = _round;
    }

    /**
     * @notice Return current block number
     */
    function blockNum() public view returns (uint256) {
        return block.number;
    }

    /**
     * @notice Return blockhash for a block
     */
    function blockHash(uint256 _block) public view returns (bytes32) {
        uint256 currentBlock = blockNum();
        require(_block < currentBlock, "can only retrieve past block hashes");
        require(currentBlock < 256 || _block >= currentBlock - 256, "can only retrieve hashes for last 256 blocks");

        return blockhash(_block);
    }

    /**
     * @notice Return blockhash for a round
     * @param _round Round number
     * @return Blockhash for `_round`
     */
    function blockHashForRound(uint256 _round) public view returns (bytes32) {
        return _blockHashForRound[_round];
    }

    /**
     * @notice Return current round
     */
    function currentRound() public view returns (uint256) {
        // Compute # of rounds since roundLength was last updated
        uint256 roundsSinceUpdate = blockNum().sub(lastRoundLengthUpdateStartBlock).div(roundLength);
        // Current round = round that roundLength was last updated + # of rounds since roundLength was last updated
        return lastRoundLengthUpdateRound.add(roundsSinceUpdate);
    }

    /**
     * @notice Return start block of current round
     */
    function currentRoundStartBlock() public view returns (uint256) {
        // Compute # of rounds since roundLength was last updated
        uint256 roundsSinceUpdate = blockNum().sub(lastRoundLengthUpdateStartBlock).div(roundLength);
        // Current round start block = start block of round that roundLength was last updated + (# of rounds since roundLenght was last updated * roundLength)
        return lastRoundLengthUpdateStartBlock.add(roundsSinceUpdate.mul(roundLength));
    }

    /**
     * @notice Check if current round is initialized
     */
    function currentRoundInitialized() public view returns (bool) {
        return lastInitializedRound == currentRound();
    }

    /**
     * @notice Check if we are in the lock period of the current round
     */
    function currentRoundLocked() public view returns (bool) {
        uint256 lockedBlocks = MathUtils.percOf(roundLength, roundLockAmount);
        return blockNum().sub(currentRoundStartBlock()) >= roundLength.sub(lockedBlocks);
    }

    /**
     * @dev Return BondingManager interface
     */
    function bondingManager() internal view returns (IBondingManager) {
        return IBondingManager(controller.getContract(keccak256("BondingManager")));
    }

    /**
     * @dev Return Minter interface
     */
    function minter() internal view returns (IMinter) {
        return IMinter(controller.getContract(keccak256("Minter")));
    }
}
