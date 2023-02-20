# Locked Citadel

## xCitadelLocker:

Allows locking of xCTDL token for 21 weeks based upon the ConvexLockerV2 model.

Some resources on locking:
- [Primer on convex locking](https://docs.convexfinance.com/convexfinance/general-information/voting-and-gauge-weights/vote-locking)
- [Convex locking UI](https://www.convexfinance.com/lock-cvx)

Locking allows users to earn governance rights and claimable xCTDL rewards.

<strong> Modifications made to convex locker: </strong>

- locker made upgradeable
- staking contract is disabled so all the xCTDL tokens would remain in the locker
- addRewards modified to allow distribution of staking token too
- `kickRewardPerEpoch` removed from function `_processExpiredLocks` to disable giving of kick rewards
