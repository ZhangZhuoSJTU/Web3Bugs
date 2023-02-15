<p align="left">
  <img src="images/pooltogether-logo--purple-gradient.png" alt="PoolTogether Brand" style="max-width:100%;" width="200px">
</p>

# PoolTogether TwabRewards contest details
- $18,750 USDC main award pot
- $1,250 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-pooltogether-twabrewards-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 9, 2021 00:00 UTC
- Ends December 12, 2021 23:59 UTC

## Contest Scope

The focus of this contest is the TWAB Reward contract that will distribute rewards to depositors in the PoolTogether V4 prize pools.

Compared to a traditional staking contract where users need to deposit tokens in order to receive rewards, PoolTogether users will only need to hold V4 prize pool tickets in order to be eligible to claim rewards.

This is made possible thanks to the [TWAB (Time-Weighted Average Balance)](https://v4.docs.pooltogether.com/protocol/concepts/time-weight-average-balance) concept introduced in V4. For an overview of V4, wardens can consult the [V4 Documentation](https://v4.docs.pooltogether.com/).

Wardens should focus on this mechanism and search for mathematical or logic errors that would allow a malicious actor to claim more rewards than they are eligible for.

This contract also supports the creation of several promotions, otherwise known as rewards campaigns. Promotions run simultaneously and distribute different types of ERC20 tokens. A promotion runs for several epochs of a fixed time duration.

Rewards are calculated based on the average amount of tickets a user holds during the epoch duration. A user should only be able to claim rewards from epochs that are already over and he should only be able to claim these once.

Representatives from PoolTogether will be available in the Code4rena Discord to answer any questions during the contest period.

## Areas of Concern

| Contract | Source Lines of Code | External Calls | Libraries |
|:------   |:------        |:------         |:------    |
| [ITwabRewards.sol](https://github.com/pooltogether/v4-periphery/blob/ceadb25844f95f19f33cb856222e461ed8edf005/contracts/interfaces/ITwabRewards.sol) | ~121 | None | OpenZeppelin IERC20 |
| [TwabRewards.sol](https://github.com/pooltogether/v4-periphery/blob/b520faea26bcf60371012f6cb246aa149abd3c7d/contracts/TwabRewards.sol) | ~378 |  [Ticket](https://github.com/pooltogether/v4-core/blob/b63fb05391ee1c2b141c0340130cd347080808e1/contracts/Ticket.sol) <br/> ERC20 token | OpenZeppelin SafeERC20 |

### Risks
- ability for a user to claim more rewards beyond their eligibility
- potential loss of funds when creating, extending or cancelling a promotion

## Links

- [Website](https://pooltogether.com)
- [V4 Prize Pool](https://v4.pooltogether.com/)
- [V4 Documentation](https://v4.docs.pooltogether.com/)
- [TWAB (Time-Weighted Average Balance) Documentation](https://v4.docs.pooltogether.com/protocol/concepts/time-weight-average-balance)
- [Discord](https://pooltogether.com/discord/)
- [Twitter](https://twitter.com/PoolTogether_)
- [Medium](https://medium.com/pooltogether)
- [Github](https://github.com/pooltogether)
