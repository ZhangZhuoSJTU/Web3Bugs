pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Governor
 * @dev The Governor holds the rights to stage and execute contract calls i.e. changing Livepeer protocol parameters.
 */
contract Governor {
    using SafeMath for uint256;

    address public owner;

    /// @dev mapping of updateHash (keccak256(update) => executeBlock (block.number + delay)
    mapping(bytes32 => uint256) public updates;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event UpdateStaged(Update update, uint256 delay);

    event UpdateExecuted(Update update);

    event UpdateCancelled(Update update);

    struct Update {
        address[] target;
        uint256[] value;
        bytes[] data;
        uint256 nonce;
    }

    /// @notice Throws if called by any account other than the owner.
    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized: msg.sender not owner");
        _;
    }

    /// @notice Throws if called by any account other than this contract.
    /// @dev Forces the `stage/execute` path to be used to call functions with this modifier instead of directly.
    modifier onlyThis() {
        require(msg.sender == address(this), "unauthorized: msg.sender not Governor");
        _;
    }

    /// @dev The Ownable constructor sets the original `owner` of the contract to the sender account.
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Allows the current owner to transfer control of the contract to a newOwner.
    /// @dev Can only be called through stage/execute, will revert if the caller is not this contract's address.
    /// @param newOwner The address to transfer ownership to.
    function transferOwnership(address newOwner) public onlyThis {
        require(newOwner != address(0), "newOwner is a null address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Stage a batch of updates to be executed.
    /// @dev Reverts if the 'msg.sender' is not the 'owner'
    /// @dev Reverts if an update is already staged
    /// @param _update Update to be staged.
    /// @param _delay (uint256) Delay (in number of blocks) for the update.
    function stage(Update memory _update, uint256 _delay) public onlyOwner {
        bytes32 updateHash = keccak256(abi.encode(_update));

        require(updates[updateHash] == 0, "update already staged");

        updates[updateHash] = block.number.add(_delay);

        emit UpdateStaged(_update, _delay);
    }

    /// @notice Execute a staged update.
    /// @dev Updates are authorized during staging.
    /// @dev Reverts if a transaction can not be executed.
    /// @param _update  Update to be staged.
    function execute(Update memory _update) public payable {
        bytes32 updateHash = keccak256(abi.encode(_update));
        uint256 executeBlock = updates[updateHash];

        require(executeBlock != 0, "update is not staged");
        require(block.number >= executeBlock, "delay for update not expired");

        // prevent re-entry and replay
        delete updates[updateHash];
        for (uint256 i = 0; i < _update.target.length; i++) {
            /* solium-disable-next-line */
            (bool success, bytes memory returnData) = _update.target[i].call.value(_update.value[i])(_update.data[i]);
            require(success, string(returnData));
        }

        emit UpdateExecuted(_update);
    }

    /// @notice Cancel a staged update.
    /// @dev Reverts if an update does not exist.
    /// @dev Reverts if the 'msg.sender' is not the 'owner'
    /// @param _update Update to be cancelled.
    function cancel(Update memory _update) public onlyOwner {
        bytes32 updateHash = keccak256(abi.encode(_update));
        uint256 executeBlock = updates[updateHash];

        require(executeBlock != 0, "update is not staged");
        delete updates[updateHash];

        emit UpdateCancelled(_update);
    }
}
