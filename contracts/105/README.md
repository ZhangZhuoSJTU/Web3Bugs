# Paladin contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-paladin-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 29, 2022 00:00 UTC
- Ends April 2, 2022 23:59 UTC

# Contest Scope

## Smart Contracts

These 2 smart contracts are the Phase 1 of the Paladin Tokenomics.   

#### HolyPaladinToken.sol (1183 sloc)
ERC20 contracts (using the OZ ERC20 base), minted by staking PAL tokens.  
hPAL is minted 1:1 with PAL staked, and returns PAL 1:1 with burned hPAL amount  
hPAL holds voting power, and allows users to delegate it to an other address. When a user starts delegating, any change on its balance
will write a new Checkpoint for voting power.  
The hPAL balance can be locked (full balance, or only part of it), for a duration going from 3 months to 2 year, blocking that locked balance from
being transfered or withdrawn  
Before withdrawing PAL by burning hPAL, the user must call the Cooldown, and wait 10 days. Any incoming transfer to the user balance while during
the Cooldown period (before the user can withdraw) will increase the user's Cooldown.  


External Calls:
- To the PAL token (PaladinToken.sol - address: [0xab846fb6c81370327e784ae7cbb6d6a6af6ff4bf](https://etherscan.io/address/0xab846fb6c81370327e784ae7cbb6d6a6af6ff4bf)) through the SafeERC20 lib.
  - line 394 : `pal.safeTransferFrom(rewardsVault, msg.sender, claimAmount);`
  - line 1070 : `pal.safeTransferFrom(user, address(this), amount);`
  - line 1098 : `pal.safeTransfer(receiver, burnAmount);`
  - line 1372 : `pal.safeTransfer(receiver, burnAmount);`


Libraries & Dependencies:
- ERC20.sol (openzeppelin)
- IERC20.sol (openzeppelin)
- SafeERC20.sol (openzeppelin)
- Ownable.sol (openzeppelin)
- Math.sol (openzeppelin)


#### PaladinRewardReserve.sol (43 sloc)
Smart contracts destined to hold PAL rewards, give an allowance to other contracts to transfer PAL from this contract to users.    

External Calls:
- To IERC20 contracts through the SafeERC20 lib.
  - line 31 : `IERC20(token).safeApprove(spender, amount);`
  - line 38 : `IERC20(token).safeApprove(spender, 0);`
  - line 39 : `IERC20(token).safeApprove(spender, amount);`
  - line 47 : `IERC20(token).safeApprove(spender, 0);`
  - line 53 : `IERC20(token).safeTransfer(receiver, amount);`


Libraries & Dependencies:
- Ownable.sol (openzeppelin)
- ReentrancyGuard.sol (openzeppelin)
- IERC20.sol (openzeppelin)
- SafeERC20.sol (openzeppelin)



## hPAL system overview

hPAL is an ERC20 with 2 layers : 

- Staking
- Locking

### Staking

PAL holders will be able to stake their PAL to receive hPAL (1:1 minting), using the `stake()` method

This is the basic hPAL token, which is transferable, and holds voting power.

To unstake (using the `unstake()` method), users need to first start a cooldown (`cooldown()` method), in a similar logic then the stkAAVE system. The cooldown period is 10 days, and after that period, users have 5 days to unstake, then the period is expired and the cooldown needs to be restarted.

### Locking

hPAL holders can then lock their balance, for a period from 3 months to 2 years. Locking brings more functionalities (rewards multiplier, extra voting power, etc ...)

User can either lock all of their balance, or just part of it.

Once locked, the balance becomes non-transferable. User can also extend their lock duration (restarting the lock timestamp), or increase the locked amount (keeping the same duration & the start timestamp).

Once the lock duration is over, the user has to either unlock, or re-lock. The user has a 2 week period to do so, after which any other user can Kick them out of the lock (using the `kick()` method), applying a penalty on the user locked balance.

The penalty is 1% of the balance for each week after the end of the lock (counting the 2 week period before being kickable out of the Lock)

Locks are saved as checkpoints, so past Locks can be fetched if needed.

The totalLocked amount is also tracked, and saved as checkpoints.

### Voting power

hPAL holds voting power, and allows users to delegate their voting power to another address.

All of this is saved as checkpoints, so past voting power can be fetched.

Locked balance bring bonus voting power (50% of the locked balance as bonus), but only when self-delegating. If the user has a Lock, and delegates to someone, then the bonus voting power is not counted.

When locking, if the user does not currently delegate, he will automatically self-delegate.

### Rewards

hPAL receives rewards each seconds, in PAL, that can be claimed at any time.

Staked balance accrues basic rewards. Locked balance accrues more rewards, through a multiplier applied to the reward distribution. Multiplier goes from 2 to 6, depending on the Lock duration.

The rewards to be distributed are held in a 2nd smart contract, approving the hPAL smart contract to transfer rewards to the user.

The amount of rewards to be distributed starts at a high amount, and decrease over a 2 year period to a base amount. This amount is updated (decreases) on a monthly basis. After the 2 years, this base amount will be sued, and do not change anymore. But this base amount could be changed (only after the 2 year period), to either be set to 0, or increased.

#### Lock multiplier:

(`userCurrentBonusRatio` in the code, all variables related to the Multiplier are named using the `BonusRatio` keyword)

The user rewards mutliplier is designed to decrease over the duration of the Lock, starting at a calculated one based on the Lock duration (x6 for the maximum duration, x2 for the minimum), and ending at x1 when at Lock expiry. After expiry, if the Lock is not removed/kicked/re-lock, then the multiplier will keep decreasing until reaching 0, acting as another penalty system (basically, the user will get less rewards than with basic staking, since a multiplier under 1 will be applied to the rewards accrued).

As the multiplier is decreasing over time, we must apply it as deceasing when accruing rewards for the user. When creating the Lock, we have the start multiplier, and we calculate the decrease per second of that multiplier over the whole duration of the Lock

Calculated via `(userLockBonusRatio - baseLockBonusRatio) / duration`, to have the Boost going from start multiplier(from x6 to x2), decrease down to x1 (the base Ratio)

Then, to calculate the accrued rewards over a given period, we take the last updated multiplier, calculate the new current multiplier (as last multiplier - (decreaseRatio * nb of seconds ellapsed)). And based on that new multiplier, and the decrease of the multiplier over the period, we calculate a temporary multiplier representing the multiplier & its decrease over time, using the formula:

`newBonusRatio + ((userRatioDecrease + bonusRatioDecrease) / 2);`

Where `bonusRatioDecrease` is the difference between the last multiplier and the new one (counted as `userRatioDecrease` multiplied by the number of seconds since the last update)

⇒ This was calculated through that formula since simulations using more basic formulas showed too much difference in accrued rewards than when calculating the rewards accrued second by second with the multiplier decreased each second

The formula `newBonusRatio + ((userRatioDecrease + bonusRatioDecrease) / 2);` can also be seen as `(newBonusRatio + lastBonusRatio + userRatioDecrease) / 2`, where the `userRatioDecrease` is added since the new multiplier that was calculated is to be used for the next time, and not be counted for the rewards to be accrued during this update.


More docs at: https://doc.paladin.vote/governance/holy-pal-hpal/smart-contract


| Glossary| |
|-------------------------------|------------------------------------------------------|
| PAL (Paladin Token)| ERC20 token |
| hPAL (Holy Paladin Token)| ERC20 token minted by staking PAL |
| Lock | Struct in the hPAL representing the part of the balance that cannot be transfered/withdrawn |
| Bonus Ratio / Multiplier | Ratio used to increase the rewards accrued by a given user, depending on Lock parameters |



## Prepare Environment

Download Hardhat & dependencies  
```
npm install
``` 

Install Foundry  
```
curl -L https://foundry.paradigm.xyz | bash
npm run setup-foundry
forge install dapphub/ds-test
forge install brockelmore/forge-std
``` 


## Tests

Tests can be found in the `./test` directory.

To run the tests : 
```
npm run test
```


## Fuzzing

Unit tests can be found in the `./src/test` directory.

To run the tests : 
```
npm run test-fuzz
```

