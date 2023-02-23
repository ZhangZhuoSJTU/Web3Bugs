## Files

Why so many?

Actually only 3 are base contracts

### RewardsDistributor

Allows reward allocators ("FundManagers") to distribute rewards.

### StakingRewards

`StakingRewards` is `InitializableRewardsDistributionRecipient`
--------------> is `StakingTokenWrapper`

This preserves the code written, tested, audited and deployed by `Synthetix` (StakingRewards & StakingTokenWrapper).

Originally: Synthetix (forked from /Synthetixio/synthetix/contracts/StakingRewards.sol)
Audit: https://github.com/sigp/public-audits/blob/master/synthetix/unipool/review.pdf`

### StakingRewardsWithPlatformToken

`StakingRewardsWithPlatformToken` is `InitializableRewardsDistributionRecipient`
-------------------------------> is `StakingTokenWrapper`

`StakingRewardsWithPlatformToken` deploys `PlatformTokenVendor` during its constructor
