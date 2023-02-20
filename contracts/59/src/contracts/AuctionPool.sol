pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./AuctionParticipant.sol";
import "./AbstractRewardMine.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IBurnMintableERC20.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/IBonding.sol";


/// @title LP Auction Pool
/// @author 0xScotch <scotch@malt.money>
/// @notice A portion of above peg profit is directed here and the capital is deployed into arbitrage auctions when possible.
/// @notice The core functionality is implemented in AuctionParticipant and AbstractRewardMine. But together they make new composite functionality.
contract AuctionPool is Initializable, AuctionParticipant, AbstractRewardMine {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  uint256 public forfeitedRewards;

  IBonding public bonding;
  address public forfeitDestination;

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardToken,
    address _auction,
    address _impliedCollateralService,
    address _bonding,
    address _miningService,
    address _forfeitDestination
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);

    bonding = IBonding(_bonding);

    _initialSetup(_rewardToken, _miningService);

    setupParticipant(
      _impliedCollateralService,
      _rewardToken,
      _auction
    );
    forfeitDestination = _forfeitDestination;
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

  function totalDeclaredReward() override public view returns (uint256) {
    // Outstanding Arb tokens + the claimable arb tokens that have been redeemed
    // minus rewards that have been forfeited
    return outstandingArbTokens() + claimableRewards - forfeitedRewards;
  }

  function totalReleasedReward() override public view returns (uint256) {
    return claimableRewards + _globalWithdrawn;
  }

  function usableBalance() override public view returns(uint256) {
    uint256 totalBalance = auctionRewardToken.balanceOf(address(this));

    if (totalBalance > claimableRewards) {
      return totalBalance - claimableRewards;
    }

    return 0;
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
      earnedReward = totalReleasedReward().mul(userReward).div(globalRewarded);
    }

    uint256 forfeitAmount = userReward.sub(earnedReward).mul(amount) / bondedBalance;
    uint256 declaredRewardDecrease = earnedReward.mul(amount) / bondedBalance;

    if (forfeitAmount > 0) {
      forfeitedRewards = forfeitedRewards + forfeitAmount;
    }

    if (declaredRewardDecrease > 0) {
      claimableRewards = claimableRewards.sub(
        declaredRewardDecrease
      );
    }
  }

  function _afterWithdraw(address account, uint256 amount) override internal {
    claimableRewards = claimableRewards.sub(amount);
  }

  function _handleRewardDistribution(uint256 rewarded) override internal {
    if (forfeitedRewards > 0) {
      uint256 coverage;
      // Need to pay down some of the forfeited amount
      if (rewarded > forfeitedRewards) {
        // Can cover everything
        coverage = forfeitedRewards;
      } else {
        coverage = rewarded;
      }

      forfeitedRewards = forfeitedRewards - coverage;
      claimableRewards = claimableRewards.sub(coverage);

      rewardToken.safeTransfer(forfeitDestination, coverage);
    }
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setBonding(address _bonding)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_bonding != address(0), "Not zero address");
    bonding = IBonding(_bonding);
  }

  function setForfeitDestination(address _forfeitDestination)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_forfeitDestination != address(0), "Not zero address");
    forfeitDestination = _forfeitDestination;
  }
}
