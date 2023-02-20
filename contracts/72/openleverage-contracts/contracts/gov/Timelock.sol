// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "@openzeppelin/contracts/math/SafeMath.sol";

/// @title Admin to all OpenLeverage contracts
/// @author OpenLeverage
/// @dev Fork from compound https://github.com/compound-finance/compound-protocol/blob/master/contracts/Timelock.sol
contract Timelock {
    using SafeMath for uint;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint indexed newDelay);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);

    uint public constant GRACE_PERIOD = 14 days;
    uint public constant MINIMUM_DELAY = 3 minutes;
    uint public constant MAXIMUM_DELAY = 3 days;

    address public admin;
    address public pendingAdmin;
    uint public delay;
    bool public admin_initialized;

    mapping(bytes32 => bool) public queuedTransactions;


    constructor(address admin_, uint delay_) {
        require(delay_ >= MINIMUM_DELAY, "Delay must exceed minimum");
        require(delay_ <= MAXIMUM_DELAY, "Delay must not exceed maximum");

        admin = admin_;
        delay = delay_;
        admin_initialized = false;
    }

    fallback() external payable {}

    receive() external payable {}

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }

    function setDelay(uint delay_) public {
        require(msg.sender == address(this), "Call must come from Timelock");
        require(delay_ >= MINIMUM_DELAY, "Delay must exceed minimum");
        require(delay_ <= MAXIMUM_DELAY, "Delay must not exceed maximum");
        delay = delay_;

        emit NewDelay(delay);
    }

    function acceptAdmin() public {
        require(msg.sender == pendingAdmin, "Call must from pendingAdmin");
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    function setPendingAdmin(address pendingAdmin_) public {
        if (admin_initialized) {
            require(msg.sender == address(this), "Call must come from Timelock");
        } else {
            require(msg.sender == admin, "Call must come from admin");
            admin_initialized = true;
        }
        pendingAdmin = pendingAdmin_;
        emit NewPendingAdmin(pendingAdmin);
    }

    /// @dev Save transactions before execution. Allowed to cancel before eta
    /// @param target Address of contract to call.
    /// @param value Amount of native token send along with the transaction.
    /// @param signature Function signature of the target contract.
    /// @param data Argument pass to the target function.
    /// @param eta time before execution.
    /// @return ID of the transaction
    function queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public returns (bytes32) {
        require(msg.sender == admin, "Call must come from admin");
        require(eta >= getBlockTimestamp().add(delay), "ETA must satisfy delay");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }

    /// @dev cancel queued transactions.
    /// @param target Address of contract to call.
    /// @param value Amount of native token send along with the transaction.
    /// @param signature Function signature of the target contract.
    /// @param data Argument pass to the target function.
    /// @param eta time before execution.
    function cancelTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public {
        require(msg.sender == admin, "Call must come from admin");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        delete queuedTransactions[txHash];

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    /// @dev execute queued transactions.
    /// @param target Address of contract to call.
    /// @param value Amount of native token send along with the transaction.
    /// @param signature Function signature of the target contract.
    /// @param data Argument pass to the target function.
    /// @param eta time before execution.
    function executeTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public payable returns (bytes memory) {
        require(msg.sender == admin, "Call must come from admin");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        if (admin_initialized) {
            require(queuedTransactions[txHash], "Tx hasn't been queued");
            require(getBlockTimestamp() >= eta, "Not surpassed timelock");
            require(getBlockTimestamp() <= eta.add(GRACE_PERIOD), "Transaction is stale");
            delete queuedTransactions[txHash];
        }

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call{value : value}(callData);
        require(success, "Transaction execution reverted");

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    function getBlockTimestamp() internal view returns (uint) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}