# PoolTogether Aave v3 contest details
- $20,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-PoolTogether-Aave-v3-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 29, 2022 00:00 UTC
- Ends May 1, 2022 23:59 UTC

# Resources

- [Code on Github](https://github.com/pooltogether/aave-v3-yield-source/tree/e63d1b0e396a5bce89f093630c282ca1c6627e44)
- [Documentation](https://dev.pooltogether.com/protocol/contracts/yield-sources/AaveV3YieldSource)

# Contest Scope

This is a contest to evaluate the Aave V3 Yield Source contract for PoolTogether.

This contract adheres to the [Yield Source Interface](https://github.com/pooltogether/yield-source-interface/blob/main/contracts/IYieldSource.sol), which is a generic interface that allows a Yield Source Prize Pool to use an external contract to generate interest. As long as a contract supports the Yield Source Interface, it can be plugged into the Yield Source Prize Pool. This makes it easy to add new yield sources.

This contract also adheres to the ERC20 standard and mints tokens to the Prize Pool when users deposit into it. These tokens represent the share of deposits owned by a Prize Pool. Users can then withdraw their deposits from the Prize Pool and these shares are then burnt. This flow is illustrated in the following diagrams:
![Deposit Flow](https://user-images.githubusercontent.com/85371239/165866541-a7ff64a6-7da7-47ac-bd1f-9d64da638d9d.png "Deposit Flow")

![Withdraw Flow](https://user-images.githubusercontent.com/85371239/165866733-a7243a5a-8a50-4652-ab29-012ef8265409.png "Withdraw Flow")

You can learn more about PoolTogether V4 and how the Yield Source Prize Pool works at the following links:
- [Smart Contracts Overview](https://dev.pooltogether.com/protocol/contracts/)
- [Flow of Funds](https://dev.pooltogether.com/protocol/architecture/flow-of-funds)
- [Yield Source Prize Pool Documentation](https://dev.pooltogether.com/protocol/contracts/v4-core/YieldSourcePrizePool)
- [Yield Source Prize Pool Contract](https://github.com/pooltogether/v4-core/blob/master/contracts/prize-pool/YieldSourcePrizePool.sol)

To learn more about Aave V3, you can read the documentation here:
- [Aave V3 Documentation](https://docs.aave.com/developers/getting-started/readme)

Only the following contract is part of the audit scope:

| Contract Name | Source Lines of Code | Libraries | External Calls |
| ------------- | -------------------- | ---------- | -------------- |
| [AaveV3YieldSource](https://github.com/pooltogether/aave-v3-yield-source/blob/e63d1b0e396a5bce89f093630c282ca1c6627e44/contracts/AaveV3YieldSource.sol) | ~200 sLoC | [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts), [Manageable](https://github.com/pooltogether/owner-manager-contracts/blob/master/contracts/Manageable.sol) | [Aave V3 Pool](https://docs.aave.com/developers/core-contracts/pool), [Aave V3 RewardsController](https://docs.aave.com/developers/periphery-contracts/rewardscontroller)

# Areas of Concern

The main areas of concern are the following:
- is the unlimited approval of the Aave V3 Pool contract safe? Focus on the [following line](https://github.com/pooltogether/aave-v3-yield-source/blob/e63d1b0e396a5bce89f093630c282ca1c6627e44/contracts/AaveV3YieldSource.sol#L183) and the functions `decreaseERC20Allowance` and `increaseERC20Allowance`.
- are the shares being calculated correctly? Focus on the `_tokenToShares` and `_sharesToToken` functions. Keep in mind that aTokens’ value is pegged to the value of the corresponding supplied asset at a 1:1 ratio.
- is the minting and burning of shares being done correctly? Focus on the `supplyTokenTo` and `redeemToken` functions.
- is there any reentrancy attack possible? Focus on the functions to withdraw and deposit.
- are functions being restricted correctly in term of ownership and managership?

# Gas Optimization

When suggesting gas optimizations, please run the `yarn test` command and write down the improvement in gas usage in your report. Don't forget to set the `REPORT_GAS` environment variable to `true` in order to generate the gas report.

# Contact

If you have any questions, don't hesitate to reach out to us on the C4 Discord channel setup for this contest.
