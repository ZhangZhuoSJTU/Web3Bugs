pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Permissions.sol";
import "./interfaces/IRewardMine.sol";


/// @title Malt Mining Service
/// @author 0xScotch <scotch@malt.money>
/// @notice A contract that abstracts one or more implementations of AbstractRewardMine
contract MiningService is Initializable, Permissions {
  address[] public mines;
  mapping(address => bool) internal mineActive;
  address public reinvestor;
  address public bonding;

  bytes32 public constant REINVESTOR_ROLE = keccak256("REINVESTOR_ROLE");
  bytes32 public constant BONDING_ROLE = keccak256("BONDING_ROLE");

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardToken,
    address _reinvestor,
    address _bonding
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _roleSetup(REINVESTOR_ROLE, _reinvestor);
    _roleSetup(BONDING_ROLE, _bonding);

    bonding = _bonding;
    reinvestor = _reinvestor;
  }

  function withdrawAccountRewards(uint256 amount)
    public
  {
    _withdrawMultiple(msg.sender, amount);
  }

  function balanceOfRewards(address account) public view returns (uint256) {
    uint256 total;
    for (uint i = 0; i < mines.length; i = i + 1) {
      if (!mineActive[mines[i]]) {
        continue;
      }
      total += IRewardMine(mines[i]).balanceOfRewards(account);
    }

    return total;
  }

  function numberOfMines() public view returns(uint256) {
    return mines.length;
  }

  function isMineActive(address mine) public view returns(bool) {
    return mineActive[mine];
  }

  function earned(address account) public view returns (uint256) {
    uint256 total;

    for (uint i = 0; i < mines.length; i = i + 1) {
      if (!mineActive[mines[i]]) {
        continue;
      }
      total += IRewardMine(mines[i]).earned(account);
    }

    return total;
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function onBond(address account, uint256 amount)
    public
    onlyRole(BONDING_ROLE, "Must have bonding privs")
  {
    for (uint i = 0; i < mines.length; i = i + 1) {
      IRewardMine mine = IRewardMine(mines[i]);
      mine.onBond(account, amount);
    }
  }

  function onUnbond(address account, uint256 amount)
    public
    onlyRole(BONDING_ROLE, "Must have bonding privs")
  {
    for (uint i = 0; i < mines.length; i = i + 1) {
      IRewardMine mine = IRewardMine(mines[i]);
      mine.onUnbond(account, amount);
    }
  }

  function setReinvestor(address _reinvestor)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_reinvestor != address(0), "Cannot use address 0");
    _swapRole(_reinvestor, reinvestor, REINVESTOR_ROLE);
    reinvestor = _reinvestor;
  }

  function setBonding(address _bonding)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_bonding != address(0), "Cannot use address 0");
    _swapRole(_bonding, bonding, REINVESTOR_ROLE);
    bonding = _bonding;
  }

  function addRewardMine(address mine)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    if (mineActive[mine]) {
      return;
    }
    mineActive[mine] = true;

    mines.push(mine);
  }

  function removeRewardMine(address mine)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    if (!mineActive[mine]) {
      return;
    }
    mineActive[mine] = false;

    // Loop until the second last element
    for (uint i = 0; i < mines.length - 1; i = i + 1) {
      if (mines[i] == mine) {
        // Replace the current item with the last and pop the last away.
        mines[i] = mines[mines.length - 1];
        mines.pop();
        return;
      }
    }

    // If we made it here then the mine being removed is the last item
    mines.pop();
  }

  function withdrawRewardsForAccount(address account, uint256 amount)
    public
    onlyRole(REINVESTOR_ROLE, "Must have reinvestor privs")
  {
    _withdrawMultiple(account, amount);
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _withdrawMultiple(address account, uint256 amount) internal {
    for (uint i = 0; i < mines.length; i = i + 1) {
      if (!mineActive[mines[i]]) {
        continue;
      }

      uint256 withdrawnAmount = IRewardMine(mines[i]).withdrawForAccount(account, amount, msg.sender);

      amount = amount.sub(withdrawnAmount);

      if (amount == 0) {
        break;
      }
    }
  }
}
