<div align="center">
<img src="concur-logo.svg" height="200px" />
</div>

# Concur Finance contest details
- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-02-concur-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts February 3, 2022 00:00 UTC
- Ends February 9, 2022 23:59 UTC

## 📑 Protocol Overview

Concur is designed to align incentives between protocols, voters and their communities with an automated rewards-sharing protocol built for the Curve and Convex ecosystem.

### The Problem

Right now, almost every new protocol that uses stablecoins uses Curve. They use it to attract liquidity, maintain their peg, gain adoption, swap between stablecoins, and generate returns for users through rewards and trading fees.

But here’s the problem... The way the Curve ecosystem works right now is that the protocols with the deepest pockets or backing by the biggest whales, pay stakeholders to get the most votes and the highest returns for their pool. Which has created a phenomenon known as: The Curve Wars.

The Curve Wars are a race between various protocols that are continuously trying to ensure that their preferred pools are offering the highest $CRV rewards to attract liquidity, generate adoption and grow protocol revenues.

These Curve Wars have created a huge opportunity for crypto whales to dominate votes for pools and protocols they’re personally invested in, even if superior options exist for users.

And this has not been good for the DeFi community. As of right now the price for “bribes” is getting out of hand. Reports say the minimum bribe required now is 0.25% of a pool. Which means new projects are quickly being priced out.

Without a doubt, if the Curve Wars continue as they presently do it will stifle innovation and hold back the emergence of the new DeFi Powered financial system we all want.

### The Solution

The future of DeFi relies on the success of the innovators, the NEW protocols with great tech, community, and probability of generating high trading volumes.  

Concur's goal is to align incentives between protocols, voters and their communities through an automated rewards-sharing protocol built for the Curve and Convex ecosystem.

The idea behind Concur, is to enable new and innovative approaches in tech and community to potentially take root and flourish without needing deep pockets. All they may need is potentially stronger tech, closer community, and this can result in new innovative pools that have higher trading volume and result in higher admin fees to veCRV stakers.

Think of Concur, as the protective ‘big brother’ of new DeFi Protocols who want to work with Curve. Instead of being forced to join the Curve wars, they can go to Concur which will create a pool for them and attract votes for them to grow their innovative solutions.

| Glossary| |
|-------------------------------|------------------------------------------------------|
| Delegators | vlCVX and veCRV holders willing to delegate their vlCVX/veCRV tokens to Concur to earn 17% Revenue Share from Stakers yield. |
| Stakers | Curve Liquidity Providers willing to stake their LP tokens on Concur to direct delegators gauge votes to their pools in exchange for 20% of their projected yield. |

## 🔍 Smart Contract Overview

### 📄 ConcurRewardPool
- ConcurRewardPool.sol
  - sloc : 41

This contract holds the rewards that has to go to Convex LP stakers.
80 % of all rewards will be pushed to stakers and user can claim tokens here.


### 📄 ConvexStakingWrapper
- ConvexStakingWrapper.sol
  - sloc : 293

Convex wrapper forked from [Convex](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapper.sol).
Modified logic is, it is no longer a ERC20, and it will hold all Convex LPs in one contract.
Convex LP holders will stake to this contract all rewards from Convex will be available in ConcurRewardPool.
When user deposits/withdraws LP, it will be notified to MasterChef.
This relies heavily on convex LP contracts and Curve pool contract.


### 📄 EasySign & VoteProxy
- EasySign.sol
  - sloc : 223
- VoteProxy.sol
  - sloc: 36

Vote proxy to enable contract signing with EIP-1271.


### 📄 MasterChef

- MasterChef.sol
  - sloc : 212

MasterChef **without** actual stake token transfers. It is used to distribute governance token without minting/depositing. Tokens will be pre-deposited before the `_startBlock`. Depositor role will be assinged to ConvexStakingWrapper and StakingRewards contract.


### 📄 Shelter
- Shelter.sol
  - sloc : 59

Shelter for tokens when emergency happens.


### 📄 StakingRewards
- StakingRewards.sol
  - sloc : 220

Single token reward contract. Will be used to give reward to governance token stakers with non-governance token (CRV/CVX).


### 📄 USDMPegRecovery
- USDMPegRecovery.sol
  - sloc : 129

USDM deposit USDM into USDM side of the contract. \
Once 40m USDM is deposited, 3Crv side of the contract starts accepting deposits. \
PBM then deposits USDM with 3Crv in 50/50 ratio as 3Crv is deposited. \
USDM deposits are locked based on the KPI’s from `carrot.eth`. \
3Crv deposits are not locked.

