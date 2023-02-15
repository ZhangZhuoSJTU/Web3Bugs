// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./Permissions.sol";


/// @title Timelock
/// @author 0xScotch <scotch@malt.money>
/// @notice Fairly basic timelock contract
contract Timelock is Initializable, Permissions {
  using SafeMath for uint256;

  // The amount of delay after which a delay can a queued can be executed.
  uint256 public delay = 2 days;
  // The the period within which an queued proposal can be executed.
  uint256 public gracePeriod = 7 days;

  mapping(bytes32 => bool) public queuedTransactions;

  event NewDelay(uint256 indexed newDelay_);
  event NewGracePeriod(uint256 indexed newGracePerios_);
  event NewGovernor(address newGovernor);
  event CancelTransaction(
    bytes32 indexed txHash_,
    address indexed target_,
    uint256 value_,
    string signature_,
    bytes data_,
    uint256 eta_
  );
  event ExecuteTransaction(
    bytes32 indexed txHash_,
    address indexed target_,
    uint256 value_,
    string signature_,
    bytes data_,
    uint256 eta_
  );
  event QueueTransaction(
    bytes32 indexed txHash_,
    address indexed target_,
    uint256 value_,
    string signature_,
    bytes data_,
    uint256 eta_
  );

  address public governor;

  function initialize(address _admin, address _governor) external initializer {
    _adminSetup(_admin);
    _setupRole(GOVERNOR_ROLE, address(this));
    _setupRole(GOVERNOR_ROLE, _governor);
    _setRoleAdmin(GOVERNOR_ROLE, TIMELOCK_ROLE);

    governor = _governor;
  }

  receive() external payable {}

  /**
   * @notice Sets the amount of time after which a proposal that has been queued can be executed.
   */
  function setDelay(uint256 _delay)
    public
    onlyRole(GOVERNOR_ROLE, "Must have timelock role")
  {
    require(
      _delay >= 0 && _delay < gracePeriod,
      "Timelock::setDelay: Delay must not be greater equal to zero and less than gracePeriod"
    );
    delay = _delay;

    emit NewDelay(delay);
  }

  /**
   * @notice Sets the amount of time within which a queued proposal can be executed.
   */
  function setGracePeriod(uint256 _gracePeriod)
    public
    onlyRole(GOVERNOR_ROLE, "Must have timelock role")
  {
    require(
      _gracePeriod > delay,
      "Timelock::gracePeriod: Grace period must be greater than delay"
    );
    gracePeriod = _gracePeriod;

    emit NewGracePeriod(gracePeriod);
  }

  /**
   * @notice Sets the governor address that is allowed to make proposals
   */
  function setGovernor(address _governor)
    public
    onlyRole(GOVERNOR_ROLE, "Must have timelock role")
  {
    _swapRole(_governor, governor, GOVERNOR_ROLE);
    governor = _governor;
    emit NewGovernor(_governor);
  }

  function queueTransaction(
    address target,
    uint256 value,
    string memory signature,
    bytes memory data,
    uint256 eta
  )
    public
    onlyRole(GOVERNOR_ROLE, "Timelock::queueTransaction: Call must come from governor.")
    returns (bytes32)
  {
    require(
      eta >= block.timestamp.add(delay),
      "Timelock::queueTransaction: Estimated execution block must satisfy delay."
    );

    bytes32 txHash = keccak256(
      abi.encode(target, value, signature, data, eta)
    );
    queuedTransactions[txHash] = true;

    emit QueueTransaction(txHash, target, value, signature, data, eta);
    return txHash;
  }

  function cancelTransaction(
    address target,
    uint256 value,
    string memory signature,
    bytes memory data,
    uint256 eta
  )
    public
    onlyRole(GOVERNOR_ROLE, "Timelock::cancelTransaction: Call must come from governor.")
  {
    bytes32 txHash = keccak256(
      abi.encode(target, value, signature, data, eta)
    );
    queuedTransactions[txHash] = false;

    emit CancelTransaction(txHash, target, value, signature, data, eta);
  }

  function executeTransaction(
    address target,
    uint256 value,
    string memory signature,
    bytes memory data,
    uint256 eta
  )
    public
    payable
    onlyRole(GOVERNOR_ROLE, "Timelock::executeTransaction: Call must come from governor.")
    returns (bytes memory)
  {
    bytes32 txHash = keccak256(
      abi.encode(target, value, signature, data, eta)
    );
    require(
      queuedTransactions[txHash],
      "Timelock::executeTransaction: Transaction hasn't been queued."
    );
    require(
      block.timestamp >= eta,
      "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
    );
    require(
      block.timestamp <= eta.add(gracePeriod),
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
}
