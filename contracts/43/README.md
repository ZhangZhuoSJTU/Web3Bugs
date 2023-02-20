# Covalent contest details
- $28,500 worth of ETH main award pot
- $1,500 worth of ETH gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-10-covalent-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts October 19, 2021 00:00 UTC
- Ends October 21, 2021 23:59 UTC

# Set up
### Installation
1. Clone repo
2. Run `npm install`

### Testing

You need to have access to an archive node. Place the node url into hardhat.config.js:
```
...
networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: "http://you.rpc.url.here",
        blockNumber: 13182263
      }
...
```
#### Run
`npx hardhat test ./test/unit-tests/*`


# Staking Explained
You can watch a walkthrough video [here](https://youtu.be/kauX-K5YDi0).

### The goal:
To distribute tokens to the stakers. For the first iteration, no external agent or entity will be updating the reward emission rate. Therefore, the emission rate will be fixed per epoch and distributed to stakeholders based on how many tokens they have staked plus their accumulated interest. One epoch is one block.

There are three types of users: Validators (who self-delegate), Delegators (who delegate tokens to the validators), and the Owner (Covalent). Delegators pay commission fees from their earned reward based on the commission rate dictated by validators. A limited number of validators will run Covalent nodes. They will set up and run the nodes, then we will add them to the contract.

### Validators are subject to the following constraints:
- Minimum # of tokens staked (self-delegated) required to a validator.
- Validator max cap - is the maximum number of tokens the delegators can cumulatively delegate to a validator. That number is determined by the following formula: `#_of_tokens_staked_by_validator * validator_max_cap_multiplier`, where `validator_max_cap_multiplier` is a number that is set by Covalent. </br>
An example of max cap: </br>
Assuming validator_max_cap_multiplier is set to `10`, then a validator comes and stakes 1 million tokens. The max cap of the validator is `10 * 1 million = 10 million`. So delegator `A` comes and delegates `3 million`, delegator `B` - `2 million`, and delegator `C` - `5 million`. In other words, the total number of tokens delegated already equals the maximum cap of `10 million`. Thus, a new delegator 'D' cannot delegate tokens to the validator unless someone unstakes their tokens.
- A validator cannot unstake tokens that would bring the stake below a minimum stake required or reduce the maximum cap below what is already delegated. If a validator is willing to do so, the validator will have to disable itself. The delegators will stop earning the rewards from that validator, but they will have an option to redelegate tokens to another validator. If the validator is willing to be enabled back, the owner will have to add another instance of the validator.
- If a validator misbehaves (does not run a Covalent node or cheats), the owner can disable the validator instance on the contract.

### Redeeming Rewards:
Delegators and validators can decide whether to withdraw all their rewards or just a portion of them and may do so at any time without a cool-down period. For taxation purposes, the users can set a different address from their wallet address to which rewards will be transferred.

### Unstaking:
Validators who self-delegate will have to wait 180 days for their unstaking to be unlocked, while delegators have to wait 28 days. Once unstaking is unlocked, tokens can be transferred back into the delegator's or validator's wallet.
An unstaked amount can always be recovered: The unstaked amount (partially or in full) can be delegated back to the same validator.

### What the owner can do:
- Deposit tokens into the contract that will be distributed
- Withdraw tokens from the contract that are supposed to be distributed. The owner cannot withdraw tokens allocated for the past epochs that have not yet been redeemed by the delegators
- Set the emission rate
- Set the validator max cap multiplier
- Set the validator minimum number of tokens staked required
- Set the validator commission rate
- Add validator instances to the contract
- Disable validator instances

### What a validator can do:
- Redeem rewards (from commissions paid to them and their earned interest)
- Stake or self-delegate
- Unstake
- Transfer out unlocked unstake
- Restake back unstake
- Disable their instances

*Note: Validators cannot set their commission rate, and if they wish to change it, they must contact Covalent. Commission rates are initially set when the owner adds a validator for the first time.*

### What a delegator can do:
- Redeem rewards (from commissions paid to them and their earned interest)
- Stake/delegate
- Unstake
- Transfer out unlocked unstake
- Restake back unstake
- If a validator is disabled, a delegator can redelegate to another validator

You can watch the UI walkthrough video [here](https://www.youtube.com/watch?v=p6_HD6PH55Q).

### Staking Math
Assuming allocated tokens per epoch = 1000

- Epoch 1 - person `A` stakes `10,000` tokens and no one else has anything staked
- Epoch 2 -
      person `A` receives `1,000` tokens reward which is `100%` of tokens allocated per epoch <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;person `B` stakes `20,000` tokens
- Epoch 3 -
      person `A` receives `355` tokens since that person's ratio of tokens staked is `35.5% = 11,000 / (11,000 + 20,000)` <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;person `B` receives `645` tokens since that person's ratio of tokens staked is `64.5% = 20,000 / (11,000 + 20,000)`

Epoch # | Staked by A | New staked added by A | Ratio owned by A | Staked by B | New staked added by B | Ratio owned by B
--- | --- | --- | --- | --- | --- |---
Epoch 1 | 0 | 10,000 | 0 | 0 | 0 |  0
Epoch 2 | 11,000 | 0 | 100% | 0 | 20,000 |  0
Epoch 3 | 11,355 | 0 | 35.5% | 20,645 | 0 | 64.5%

### Staking Math Contract Implementation

View the spreadsheet for a better understanding [here](https://docs.google.com/spreadsheets/d/1OX6-l0fzjr1qykl-KF7Q1pYMTLuHYcwThehZEGvR49o/edit?usp=sharing).

We use the concept of ratios or in other words, exchange rates.
There is a global exchange rate and an exchange rate per validator.
Stakers buy both global and validator shares.
When they unstake or redeem the rewards, they sell global and per validator shares.

- Initially, the global exchange rate and validator exchange rate is `1 share = 1 token`.

- Then staker `A` comes and stakes `10,000` tokens, so receives `10,000` global shares and `10,000` per validator shares.

- Assume the emission rate is `1000` tokens per epoch, and the validator commission rate is `25%`.

- In the next epoch, `1000` tokens will be distributed between `10,000` global shares and `10,000` validator shares.

- The new global exchange rate will become:

```old_global_exchange_rate + 1000 tokens / 10,000 global shares = 1 + 0.1 = 1.1```

- As per the validator exchange rate, since there is a commission rate of `25%`, `250` tokens will go towards commission paid, and `750` tokens are distributed among validator shares.

- Then the validator exchange rate would be:

```old_validator_exchange_rate + 750 tokens / 10,000 validator shares = 1 + 0.075 = 1.075```

- So `1 global share = 1.1` tokens and `1 validator share = 1.075` tokens, a validator will have `250` commission tokens available to redeem.

- If a validator decides to redeem the commission, `250` tokens convert to global shares: `250 / 1.1 = ~ 227.2727 shares`.

- The new global number of shares would be `10,000 - 227.27 = 9772.73`. We do not need to subtract any number from per validator share since these already exclude the commission rate.

### Precision Loss

There is a slight precision loss in rewards calculation. It is acceptable as long as it is small enough (less than ~ 0.01 a day).
