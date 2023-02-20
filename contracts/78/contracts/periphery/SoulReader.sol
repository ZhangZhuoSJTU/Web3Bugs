// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../facades/LimboLike.sol";
import "../facades/LimboDAOLike.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import "hardhat/console.sol";

/**
 *@title SoulReader
 * @author Justin Goro
 * @notice Coneptually similar to the Router contracts in Uniswap, this is a helper contract for reading Limbo data in a manner more friendly to a UI
 * @dev passing the limbo contract address in allows the SoulReader to remain stateless and also allows front end devs to perform comparisons and experiments in real time.
 */
contract SoulReader {
  uint256 constant TERA = 1E12;
  struct Soul {
    uint256 lastRewardTimestamp; //I know masterchef counts by block but this is less reliable than timestamp.
    uint256 accumulatedFlanPerShare;
    uint256 crossingThreshold; //the value at which this soul is elligible to cross over to Behodler
    uint256 soulType;
    uint256 state;
    uint256 flanPerSecond;
  }

  function getLimbo(address _limbo) internal pure returns (LimboLike) {
    return LimboLike(_limbo);
  }

  /**
   *@param token the token contract address
   *@param _limbo the limbo contract address
   */
  function SoulStats(address token, address _limbo)
    public
    view
    returns (
      uint256, //state
      uint256, //staked balance
      uint256 //fps
    )
  {
    LimboLike limbo = getLimbo(_limbo);
    uint256 latestIndex = limbo.latestIndex(token);
    (, , , , uint256 state, uint256 fps) = limbo.souls(token, latestIndex);
    uint256 stakeBalance = IERC20(token).balanceOf(address(limbo));
    return (state, stakeBalance, fps);
  }

  /**
   *@param token the token contract address
   *@param _limbo the limbo contract address
   */
  function CrossingParameters(address token, address _limbo)
    public
    view
    returns (
      uint256, //initialCrossingbonus
      int256, //bonusDelta,
      uint256 //fps
    )
  {
    LimboLike limbo = getLimbo(_limbo);
    uint256 latestIndex = limbo.latestIndex(token);
    (, , , , , uint256 flanPerSecond) = limbo.souls(token, latestIndex);

    (, , int256 crossingBonusDelta, uint256 initialCrossingBonus, ) = limbo.tokenCrossingParameters(token, latestIndex);
    return (initialCrossingBonus, crossingBonusDelta, flanPerSecond);
  }

  /**
   *@notice Query the pending rewards for a given soul by a given staked user
   *@dev performing these calculations client side is difficult and frought with bugs.
   *@param account staked user
   *@param token the token contract address
   *@param _limbo the limbo contract address
   */
  function GetPendingReward(
    address account,
    address token,
    address _limbo
  ) external view returns (uint256) {
    LimboLike limbo = getLimbo(_limbo);
    uint256 latestIndex = limbo.latestIndex(token);
    Soul memory soul; //stack too deep avoidance
    (soul.lastRewardTimestamp, soul.accumulatedFlanPerShare, , , soul.state, soul.flanPerSecond) = limbo.souls(
      token,
      latestIndex
    );

    (, uint256 stakingEndsTimestamp, , , ) = limbo.tokenCrossingParameters(token, latestIndex);
    uint256 finalTimeStamp = soul.state != 1 ? stakingEndsTimestamp : block.timestamp;
    uint256 limboBalance = IERC20(token).balanceOf(address(limbo));

    (uint256 stakedAmount, uint256 rewardDebt, ) = limbo.userInfo(token, account, latestIndex);
    if (limboBalance > 0) {
      soul.accumulatedFlanPerShare =
        soul.accumulatedFlanPerShare +
        (((finalTimeStamp - soul.lastRewardTimestamp) * soul.flanPerSecond * (1e12)) / limboBalance);
    }
    uint256 accumulated = ((stakedAmount * soul.accumulatedFlanPerShare) / (1e12));
    if (accumulated >= rewardDebt) return accumulated - rewardDebt;
    return 0;
  }

  //For rebase tokens, make the appropriate adjustments on the front end, not here.
  //Only call this on live souls.
  /**
   * @notice For threshold souls, calculate the crossing bonus for a given staked user
   * @param holder user staked
   * @param token the soul
   * @param _limbo the limbo contract address
   */
  function ExpectedCrossingBonus(
    address holder,
    address token,
    address _limbo
  ) external view returns (uint256 flanBonus) {
    LimboLike limbo = getLimbo(_limbo);
    uint256 latestIndex = limbo.latestIndex(token);
    (uint256 stakedAmount, , bool bonusPaid) = limbo.userInfo(token, holder, latestIndex);
    if (bonusPaid) return 0;
    uint256 bonusRate = ExpectedCrossingBonusRate(holder, token, _limbo);
    flanBonus = (bonusRate * stakedAmount) / TERA;
  }

  function ExpectedCrossingBonusRate(
    address holder,
    address token,
    address _limbo
  ) public view returns (uint256 bonusRate) {
    LimboLike limbo = getLimbo(_limbo);
    uint256 latestIndex = limbo.latestIndex(token);

    (uint256 stakedAmount, , bool bonusPaid) = limbo.userInfo(token, holder, latestIndex);
    if (bonusPaid) return 0;

    (uint256 stakingBegins, uint256 stakingEnds, int256 crossingBonusDelta, uint256 initialCrossingBonus, ) = limbo
      .tokenCrossingParameters(token, latestIndex);
    stakingEnds = stakingEnds == 0 ? block.timestamp : stakingEnds;
    stakingBegins = stakingBegins == 0 ? block.timestamp - 1 : stakingBegins;

    int256 accumulatedFlanPerTeraToken = crossingBonusDelta * int256(stakingEnds - stakingBegins);
    // console.log("token: %d", token);
    // console.log("time elapsed %d", stakingEnds - stakingBegins);
    // console.log(
    //   "accumulatedFlanPerTeraToken %d, initialCrossingBonus %d",
    //   uint256(accumulatedFlanPerTeraToken),
    //   uint256(initialCrossingBonus)
    // );
    int256 finalFlanPerTeraToken = int256(initialCrossingBonus) +
      (stakedAmount > 0 ? accumulatedFlanPerTeraToken : int256(0));
    bonusRate = finalFlanPerTeraToken > 0 ? uint256(finalFlanPerTeraToken) : 0;
  }
}
