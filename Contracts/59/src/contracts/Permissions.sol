pragma solidity >=0.6.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/// @title Permissions
/// @author 0xScotch <scotch@malt.money>
/// @notice Inherited by almost all Malt contracts to provide access control
contract Permissions is AccessControl {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  // Timelock has absolute power across the system
  bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

  // Can mint/burn Malt
  bytes32 public constant MONETARY_BURNER_ROLE = keccak256("MONETARY_BURNER_ROLE");
  bytes32 public constant MONETARY_MINTER_ROLE = keccak256("MONETARY_MINTER_ROLE");

  // Contract types
  bytes32 public constant STABILIZER_NODE_ROLE = keccak256("STABILIZER_NODE_ROLE");
  bytes32 public constant LIQUIDITY_MINE_ROLE = keccak256("LIQUIDITY_MINE_ROLE");
  bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");
  bytes32 public constant REWARD_THROTTLE_ROLE = keccak256("REWARD_THROTTLE_ROLE");

  address internal globalAdmin;

  mapping(address => uint256) public lastBlock; // protect against reentrancy

  function _adminSetup(address _timelock) internal {
    _roleSetup(TIMELOCK_ROLE, _timelock);
    _roleSetup(ADMIN_ROLE, _timelock);
    _roleSetup(GOVERNOR_ROLE, _timelock);
    _roleSetup(MONETARY_BURNER_ROLE, _timelock);
    _roleSetup(MONETARY_MINTER_ROLE, _timelock);
    _roleSetup(STABILIZER_NODE_ROLE, _timelock);
    _roleSetup(LIQUIDITY_MINE_ROLE, _timelock);
    _roleSetup(AUCTION_ROLE, _timelock);
    _roleSetup(REWARD_THROTTLE_ROLE, _timelock);

    globalAdmin = _timelock;
  }

  function assignRole(bytes32 role, address _assignee)
    external
    onlyRole(TIMELOCK_ROLE, "Only timelock can assign roles")
  {
    _setupRole(role, _assignee);
  }

  function removeRole(bytes32 role, address _entity)
    external
    onlyRole(TIMELOCK_ROLE, "Only timelock can revoke roles")
  {
    revokeRole(role, _entity);
  }

  function reassignGlobalAdmin(address _admin)
    external
    onlyRole(TIMELOCK_ROLE, "Only timelock can assign roles")
  {
    _swapRole(_admin, globalAdmin, TIMELOCK_ROLE);
    _swapRole(_admin, globalAdmin, ADMIN_ROLE);
    _swapRole(_admin, globalAdmin, GOVERNOR_ROLE);
    _swapRole(_admin, globalAdmin, MONETARY_BURNER_ROLE);
    _swapRole(_admin, globalAdmin, MONETARY_MINTER_ROLE);
    _swapRole(_admin, globalAdmin, STABILIZER_NODE_ROLE);
    _swapRole(_admin, globalAdmin, LIQUIDITY_MINE_ROLE);
    _swapRole(_admin, globalAdmin, AUCTION_ROLE);
    _swapRole(_admin, globalAdmin, REWARD_THROTTLE_ROLE);

    globalAdmin = _admin;
  }

  function emergencyWithdrawGAS(address payable destination)
    external 
    onlyRole(TIMELOCK_ROLE, "Only timelock can assign roles")
  {
    // Transfers the entire balance of the Gas token to destination
    destination.call{value: address(this).balance}('');
  }

  function emergencyWithdraw(address _token, address destination)
    external 
    onlyRole(TIMELOCK_ROLE, "Must have timelock role")
  {
    // Transfers the entire balance of an ERC20 token at _token to destination
    ERC20 token = ERC20(_token);
    token.safeTransfer(destination, token.balanceOf(address(this)));
  }

  function partialWithdrawGAS(address payable destination, uint256 amount)
    external 
    onlyRole(TIMELOCK_ROLE, "Must have timelock role")
  {
    destination.call{value: amount}('');
  }

  function partialWithdraw(address _token, address destination, uint256 amount)
    external 
    onlyRole(TIMELOCK_ROLE, "Only timelock can assign roles")
  {
    ERC20 token = ERC20(_token);
    token.safeTransfer(destination, amount);
  }

  /*
   * INTERNAL METHODS
   */
  function _swapRole(address newAccount, address oldAccount, bytes32 role) internal {
    revokeRole(role, oldAccount);
    _setupRole(role, newAccount);
  }

  function _roleSetup(bytes32 role, address account) internal {
    _setupRole(role, account);
    _setRoleAdmin(role, ADMIN_ROLE);
  }

  function _onlyRole(bytes32 role, string memory reason) internal view {
    require(
      hasRole(
        role,
        _msgSender()
      ),
      reason
    );
  }

  function _notSameBlock() internal {
    require(
      block.number > lastBlock[_msgSender()],
      "Can't carry out actions in the same block"
    );
    lastBlock[_msgSender()] = block.number;
  }

  // Using internal function calls here reduces compiled bytecode size
  modifier onlyRole(bytes32 role, string memory reason) {
    _onlyRole(role, reason);
    _;
  }

  modifier notSameBlock() {
    _notSameBlock();
    _;
  }
}
