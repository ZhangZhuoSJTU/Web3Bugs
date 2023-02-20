// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.9;

import "../interfaces/governance/ITimelock.sol";

/**
 * @dev Implementation of {Timelock} contract.
 *
 * It allows queueing, execution and cancellation of transactions by the
 * {admin}. A queued transaction can be executed after the cool-time represented
 * by {delay} has elapsed and grace period has not passed since the queuing
 * of transaction.
 *
 * It allows changing of contract's admin through a queued transaction by the
 * prior admin. The new admin the calls {acceptAdmin} to accept its role.
 */
contract Timelock is ITimelock {
    // Current admin of the contract
    address public admin;

    // Pending admin of the contract
    address public pendingAdmin;

    // Cool-off before a queued transaction is executed
    uint256 public override delay;

    // Queued status of a transaction (txHash => tx status).
    mapping(bytes32 => bool) public override queuedTransactions;

    // Emitted when a new admin is set
    event NewAdmin(address indexed newAdmin);

    // Emitted when a new pending admin is set
    event NewPendingAdmin(address indexed newPendingAdmin);

    // Emitted when a new delay/cool-off time is set
    event NewDelay(uint256 indexed newDelay);

    // Emitted when a tx is cancelled
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    // Emitted when a tx is executed
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    // Emitted when a tx is queued
    event QueueTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    /**
     * @dev Allows of receiving of ether beforehand or in bulk, so the sending
     * ether is optional at the time of tx execution.
     */
    receive() external payable {}

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Sets contract's state variable of {admin} and {delay}
     *
     * Requirements:
     * - `admin_` param must not be a zero address
     * - `delay_` param must be within range or min and max delay
     */
    constructor(address admin_, uint256 delay_) {
        require(
            delay_ >= MINIMUM_DELAY(),
            "Timelock::constructor: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY(),
            "Timelock::constructor: Delay must not exceed maximum delay."
        );

        require(
            admin_ != address(0),
            "Timelock::constructor: Admin cannot be zero"
        );

        admin = admin_;
        delay = delay_;
    }

    /* ========== VIEWS ========== */
    /**
     * @dev Returns the time period a tx is valid for execution after eta has elapsed.
     */
    function GRACE_PERIOD() public pure virtual override returns (uint256) {
        return 14 days;
    }

    /**
     * @dev Returns the minimum delay required for execution after a tx is queued
     */
    function MINIMUM_DELAY() public pure virtual returns (uint256) {
        return 2 days;
    }

    /**
     * @dev Returns the maxium delay required for execution after a tx is queued
     */
    function MAXIMUM_DELAY() public pure virtual returns (uint256) {
        return 30 days;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Sets the the new value of {delay}.
     * It allows setting of new delay value through queued tx by the admin
     *
     * Requirements:
     * - only current contract can call it
     * - `delay_` param must be within the min and max delay range
     */
    function setDelay(uint256 delay_) public {
        require(
            msg.sender == address(this),
            "Timelock::setDelay: Call must come from Timelock."
        );
        require(
            delay_ >= MINIMUM_DELAY(),
            "Timelock::setDelay: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY(),
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = delay_;

        emit NewDelay(delay);
    }

    /**
     * @dev Sets {pendingAdmin} to admin of current contract.
     * A {GovernorAlpha} contract which is already set as {pendingAdmin}
     * of this contract calls this function to set itself as new admin.
     *
     * Requirements:
     * - only callable by {pendingAdmin}
     */
    function acceptAdmin() public override {
        require(
            msg.sender == pendingAdmin,
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    /**
     * @dev Sets the the new value of {pendingAdmin_}.
     * It allows setting of new pendingAdmin value through queued tx by the admin
     *
     * Requirements:
     * - only current contract can call it
     */
    function setPendingAdmin(address pendingAdmin_) public {
        require(
            msg.sender == address(this),
            "Timelock::setPendingAdmin: Call must come from Timelock."
        );
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    /**
     * @dev Queues a transaction by setting its status in {queuedTransactions} mapping.
     *
     * Requirements:
     * - only callable by {admin}
     * - `eta` must lie in future compared to delay referenced from current block
     */
    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public override returns (bytes32 txHash) {
        require(
            msg.sender == admin,
            "Timelock::queueTransaction: Call must come from admin."
        );
        require(
            eta >= getBlockTimestamp() + delay,
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
    }

    /**
     * @dev Cancels a transaction by setting its status in {queuedTransactions} mapping.
     *
     * Requirements:
     * - only callable by {admin}
     */
    function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public override {
        require(
            msg.sender == admin,
            "Timelock::cancelTransaction: Call must come from admin."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    /**
     * @dev Executes a transaction by making a low level call to its `target`.
     * The call reverts if the low-level call made to `target` reverts.
     *
     * Requirements:
     * - only callable by {admin}
     * - tx must already be queued
     * - current timestamp is ahead of tx's eta
     * - grace period associated with the tx must not have passed
     * - the low-level call to tx's `target` must not revert
     */
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public payable override returns (bytes memory) {
        require(
            msg.sender == admin,
            "Timelock::executeTransaction: Call must come from admin."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        require(
            queuedTransactions[txHash],
            "Timelock::executeTransaction: Transaction hasn't been queued."
        );
        require(
            getBlockTimestamp() >= eta,
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            getBlockTimestamp() <= eta + GRACE_PERIOD(),
            "Timelock::executeTransaction: Transaction is stale."
        );

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call{value: value}(
            callData
        );

        require(
            success,
            "Timelock::executeTransaction: Transaction execution reverted."
        );

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Gets timestamp from the current block.
     */
    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
