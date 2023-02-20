pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./AbstractRewardMine.sol";
import "./interfaces/IDistributor.sol";
import "./interfaces/IBonding.sol";


/// @title ERC20 Vested Mine
/// @author 0xScotch <scotch@malt.money>
/// @notice An implementation of AbstractRewardMine to handle rewards being vested by the RewardDistributor
contract ERC20VestedMine is Initializable, AbstractRewardMine {
  IDistributor public distributor;
  IBonding public bonding;

  function initialize(
    address _timelock,
    address initialAdmin,
    address _miningService,
    address _distributor,
    address _bonding,
    address _rewardToken
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);

    distributor = IDistributor(_distributor);
    bonding = IBonding(_bonding);

    _initialSetup(_rewardToken, _miningService);
  }

  function onUnbond(address account, uint256 amount)
    override
    public
    onlyRole(MINING_SERVICE_ROLE, "Must having mining service privilege")
  {
    // Withdraw all current rewards
    // Done now before we change stake padding below
    uint256 rewardEarned = earned(account);
    _handleWithdrawForAccount(account, rewardEarned, account);

    uint256 bondedBalance = balanceOfBonded(account);

    if (bondedBalance == 0) {
      return;
    }

    _checkForForfeit(account, amount, bondedBalance);

    uint256 lessStakePadding = balanceOfStakePadding(account).mul(amount).div(bondedBalance);

    _reconcileWithdrawn(account, amount, bondedBalance);
    _removeFromStakePadding(account, lessStakePadding, "< stake padding");
  }

  function totalBonded() override public view returns (uint256) {
    return bonding.totalBonded();
  }

  function balanceOfBonded(address account) override public view returns (uint256) {
    return bonding.balanceOfBonded(account);
  }

  /*
   * totalReleasedReward and totalDeclaredReward will often be the same. However, in the case
   * of vesting rewards they are different. In that case totalDeclaredReward is total
   * reward, including unvested. totalReleasedReward is just the rewards that have completed
   * the vesting schedule.
   */
  function totalDeclaredReward() override public view returns (uint256) {
    return distributor.totalDeclaredReward();
  }

  function totalReleasedReward() override public view returns (uint256) {
    return rewardToken.balanceOf(address(this)) + _globalWithdrawn;
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _checkForForfeit(address account, uint256 amount, uint256 bondedBalance) internal {
    // This is the user's share of total rewards
    uint256 userReward = balanceOfRewards(account);
    uint256 globalRewarded = totalDeclaredReward();

    uint256 earnedReward = 0;
    
    // This is done inline instead of using earned() to save gas
    if (globalRewarded > 0 && userReward > 0) {
      // Note this doesn't factor in withdrawn as it is working
      // on absolute reward terms
      earnedReward = totalReleasedReward().mul(userReward) / globalRewarded;
    }

    // The user is unbonding so we should reduce declaredReward
    // proportional to the unbonded amount
    // At any given point in time, every user has rewards allocated
    // to them. balanceOfRewards(account) will tell you this value.
    // If a user unbonds x% of their LP then declaredReward should
    // reduce by exactly x% of that user's allocated rewards

    // However, this has to be done in 2 parts. First forfeit x%
    // Of unvested rewards. This decrements declaredReward automatically.
    // Then we call decrementRewards using x% of rewards that have 
    // already been released. The net effect is declaredReward decreases
    // by x% of the users allocated reward

    uint256 forfeitReward = userReward.sub(earnedReward).mul(amount) / bondedBalance;
    uint256 declaredRewardDecrease = earnedReward.mul(amount) / bondedBalance;

    if (forfeitReward > 0) {
      distributor.forfeit(forfeitReward);
    }

    if (declaredRewardDecrease > 0) {
      distributor.decrementRewards(declaredRewardDecrease);
    }
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setDistributor(address _distributor)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    distributor = IDistributor(_distributor);
  }

  function setBonding(address _bonding)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    bonding = IBonding(_bonding);
  }
}
