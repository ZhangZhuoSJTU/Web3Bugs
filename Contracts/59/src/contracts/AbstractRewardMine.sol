pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./Permissions.sol";


/// @title Abstract Reward Mine
/// @author 0xScotch <scotch@malt.money>
/// @notice The base functionality for tracking user reward ownership, withdrawals etc
/// @dev The contract is abstract so needs to be inherited
abstract contract AbstractRewardMine is Permissions {
  using SafeMath for uint256;

  bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
  bytes32 public constant MINING_SERVICE_ROLE = keccak256("MINING_SERVICE_ROLE");

  ERC20 public rewardToken;
  address public miningService;

  uint256 internal _globalStakePadding;
  uint256 internal _globalWithdrawn;
  mapping(address => uint256) internal _userStakePadding;
  mapping(address => uint256) internal _userWithdrawn;

  event Withdraw(address indexed account, uint256 rewarded, address indexed to);

  function onBond(address account, uint256 amount)
    virtual
    public
    onlyRole(MINING_SERVICE_ROLE, "Must having mining service privilege")
  {
    _beforeBond(account, amount);
    _handleStakePadding(account, amount);
    _afterBond(account, amount);
  }

  function onUnbond(address account, uint256 amount)
    virtual
    public
    onlyRole(MINING_SERVICE_ROLE, "Must having mining service privilege")
  {
    _beforeUnbond(account, amount);
    // Withdraw all current rewards
    // Done now before we change stake padding below
    uint256 rewardEarned = earned(account);
    _handleWithdrawForAccount(account, rewardEarned, account);

    uint256 bondedBalance = balanceOfBonded(account);

    if (bondedBalance == 0) {
      return;
    }

    uint256 lessStakePadding = balanceOfStakePadding(account).mul(amount).div(bondedBalance);

    _reconcileWithdrawn(account, amount, bondedBalance);
    _removeFromStakePadding(account, lessStakePadding, "< stake padding");
    _afterUnbond(account, amount);
  }

  function _initialSetup(address _rewardToken, address _miningService) internal {
    _roleSetup(MINING_SERVICE_ROLE, _miningService);
    _roleSetup(REWARD_MANAGER_ROLE, _miningService);

    rewardToken = ERC20(_rewardToken);
    miningService = _miningService;
  }

  function withdrawAll() public {
    uint256 rewardEarned = earned(msg.sender);

    _handleWithdrawForAccount(msg.sender, rewardEarned, msg.sender);
  }

  function withdraw(uint256 rewardAmount) external {
    uint256 rewardEarned = earned(msg.sender);

    require(rewardAmount <= rewardEarned, "< earned");
    
    _handleWithdrawForAccount(msg.sender, rewardAmount, msg.sender);
  }

  /*
   * METHODS TO OVERRIDE
   */
  function totalBonded() virtual public view returns (uint256);
  function balanceOfBonded(address account) virtual public view returns (uint256);

  /*
   * totalReleasedReward and totalDeclaredReward will often be the same. However, in the case
   * of vesting rewards they are different. In that case totalDeclaredReward is total
   * reward, including unvested. totalReleasedReward is just the rewards that have completed
   * the vesting schedule.
   */
  function totalDeclaredReward() virtual public view returns (uint256) {
    return rewardToken.balanceOf(address(this));
  }
  function totalReleasedReward() virtual public view returns (uint256) {
    return rewardToken.balanceOf(address(this)) + _globalWithdrawn;
  }

  /*
   * PUBLIC VIEW FUNCTIONS
   */
  function totalStakePadding() public view returns(uint256) {
    return _globalStakePadding;  
  }

  function balanceOfStakePadding(address account) public view returns (uint256) {
    return _userStakePadding[account];
  }

  function totalWithdrawn() public view returns (uint256) {
    return _globalWithdrawn;
  }

  function withdrawnBalance(address account) public view returns (uint256) {
    return _userWithdrawn[account];
  }

  function getRewardOwnershipFraction(address account) public view returns(uint256 numerator, uint256 denominator) {
    numerator = balanceOfRewards(account);
    denominator = totalDeclaredReward();
  }

  function balanceOfRewards(address account) public view returns (uint256) {
    /*
     * This represents the rewards allocated to a given account but does not
     * mean all these rewards are unlocked yet. The earned method will
     * fetch the balance that is unlocked for an account
     */
    uint256 balanceOfRewardedWithStakePadding = _getFullyPaddedReward(account);

    uint256 stakePaddingBalance = balanceOfStakePadding(account);

    if (balanceOfRewardedWithStakePadding > stakePaddingBalance) {
      return balanceOfRewardedWithStakePadding - stakePaddingBalance;
    }
    return 0;
  }

  function earned(address account) public view returns (uint256 earnedReward) {
    (uint256 rewardNumerator, uint256 rewardDenominator) = getRewardOwnershipFraction(account);

    if (rewardDenominator > 0) {
      earnedReward = totalReleasedReward().mul(rewardNumerator).div(rewardDenominator).sub(_userWithdrawn[account]);
    }
  }

  /*
   * INTERNAL VIEW FUNCTIONS
   */
  function _getFullyPaddedReward(address account) internal view returns (uint256) {
    uint256 globalBondedTotal = totalBonded();
    if (globalBondedTotal == 0) {
      return 0;
    }

    uint256 totalRewardedWithStakePadding = totalDeclaredReward().add(totalStakePadding());
    
    return totalRewardedWithStakePadding
      .mul(balanceOfBonded(account))
      .div(globalBondedTotal);
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _withdraw(address account, uint256 amountReward, address to) internal {
    rewardToken.safeTransfer(to, amountReward);
    _userWithdrawn[account] += amountReward;
    _globalWithdrawn += amountReward;

    emit Withdraw(account, amountReward, to);
  }

  function _handleStakePadding(address account, uint256 amount) internal {
    uint256 totalRewardedWithStakePadding = totalDeclaredReward().add(totalStakePadding());

    uint256 INITIAL_STAKE_SHARE_MULTIPLE = 1e6;

    uint256 bondedTotal = totalBonded();

    uint256 newStakePadding = bondedTotal == 0 ?
      totalDeclaredReward() == 0 ? amount.mul(INITIAL_STAKE_SHARE_MULTIPLE) : 0 :
      totalRewardedWithStakePadding.mul(amount).div(bondedTotal);

    _addToStakePadding(account, newStakePadding);
  }

  function _addToStakePadding(address account, uint256 amount) internal {
    _userStakePadding[account] = _userStakePadding[account].add(amount);

    _globalStakePadding = _globalStakePadding.add(amount);
  }

  function _removeFromStakePadding(
    address account,
    uint256 amount,
    string memory reason
  ) internal {
    _userStakePadding[account] = _userStakePadding[account].sub(amount, reason);

    _globalStakePadding = _globalStakePadding.sub(amount, reason);
  }

  function _reconcileWithdrawn(
    address account,
    uint256 amount,
    uint256 bondedBalance
  ) internal {
    uint256 withdrawDiff = _userWithdrawn[account].mul(amount) / bondedBalance;
    _userWithdrawn[account] = _userWithdrawn[account].sub(withdrawDiff, "< withdrawn");
    _globalWithdrawn = _globalWithdrawn.sub(withdrawDiff, "< global withdrawn");
  }

  function _handleWithdrawForAccount(address account, uint256 rewardAmount, address to) internal {
    _beforeWithdraw(account, rewardAmount);

    _withdraw(account, rewardAmount, to);

    _afterWithdraw(account, rewardAmount);
  }

  /*
   * HOOKS
   */
  function _beforeWithdraw(address account, uint256 amount) virtual internal {
    // hook
  }

  function _afterWithdraw(address account, uint256 amount) virtual internal {
    // hook
  }

  function _beforeBond(address account, uint256 amount) virtual internal {
    // hook
  }

  function _afterBond(address account, uint256 amount) virtual internal {
    // hook
  }

  function _beforeUnbond(address account, uint256 amount) virtual internal {
    // hook
  }

  function _afterUnbond(address account, uint256 amount) virtual internal {
    // hook
  }

  /*
   * PRIVILEDGED METHODS
   */
  function withdrawForAccount(address account, uint256 amount, address to)
    external
    onlyRole(REWARD_MANAGER_ROLE, "Must have reward manager privs")
    returns (uint256)
  {
    uint256 rewardEarned = earned(account);

    if (rewardEarned < amount) {
      amount = rewardEarned;
    }
    
    _handleWithdrawForAccount(account, amount, to);

    return amount;
  }

  function setRewardToken(address _token)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    rewardToken = ERC20(_token);
  }

  function setMiningService(address _miningService)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    _swapRole(_miningService, miningService, MINING_SERVICE_ROLE);
    _swapRole(_miningService, miningService, REWARD_MANAGER_ROLE);
    miningService = _miningService;
  }
}
