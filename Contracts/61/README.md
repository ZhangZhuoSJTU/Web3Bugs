# Sublime Code4rena Contest Details

- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-sublime-contest/submit)
- Read our guidelines for more details
- Starts December 9, 2021 00:00 UTC
- Ends December 15, 2021 23:59 UTC

# Overview

Sublime is a decentralized protocol for building and accessing credit. Borrowers can use Sublime to create fully-customizable loan pools or credit lines, allowing them to utilize their social capital to borrow undercollateralized loans from lenders that trust them. The protocol has been developed with the idea of trust minimization - a lender’s capital is only utilized by borrowers they trust. Integration with overcollateralized money markets like Compound enables lenders to generate passive yield on their assets for times when users they trust aren’t actively borrowing. Sublime also features a flexible identity verification module which allows users to link their identities to their wallet addresses to bootstrap their on-chain reputation.


For more information, please refer to the [documentation](https://docs.sublime.finance/).

To learn more, please join the [Sublime Discord server](https://discord.gg/cnadj5hFwh).

# Video Intro

Here's a quick overview explaning the architecture and what we're building: [https://www.youtube.com/watch?v=L8IExC-cT8E](https://www.youtube.com/watch?v=L8IExC-cT8E)

# Audit Scope

Please note that the contest duration is 1 week.

The scope includes the following files:
| Pool | SLOC|
| ---- | ----- |
| /contracts/Pool/Pool.sol | 312 |
| /contracts/Pool/Extension.sol | 69 |
| /contracts/Pool/PoolFactory.sol | 174 |
| /contracts/Pool/Repayments.sol | 177 |

| Credit Lines | SLOC |
| ----- | ----- |
| /contracts/CreditLine/CreditLine.sol | 346 |

| Savings Account | SLOC |
| ----- | ----- |
| /contracts/SavingsAccount/SavingsAccount.sol | 125 |
| /contracts/SavingsAccount/SavingsAccountUtil.sol | 43 |

| Verification | SLOC |
| ----- | ----- |
| /contracts/Verification/Verification.sol | 40 |
| /contracts/Verification/adminVerifier.sol | 18 |

| Yield | SLOC |
| ----- | ----- |
| /contracts/yield/AaveYield.sol | 97 |
| /contracts/yield/CompoundYield.sol | 75 |
| /contracts/yield/YearnYield.sol | 74 |
| /contracts/yield/NoYield.sol | 42 |
| /contracts/yield/StrategyRegistry.sol | 34 |

| Misc. | SLOC |
| ----- | ----- |
| /contracts/PriceOracle.sol | 62 |
| /contracts/Proxy.sol | 1 |

# Installation and Testing Steps
Requirements
1. node version >12.x
2. npm version >6.x

### Once the repo is cloned run the command below to install all the dependencies
> npm install --save-dev 

### Create a .env file with contents as mentioned

> touch .env

Atleast 4 private keys must be provided. The keys must be comma seperated as shown below

`privKey1,privKey2,privKey3,privKey4`

It recommended to use new private keys whenever you clone the repo. You generate new private keys using https://vanity-eth.tk/

**Sample .env file:**
```
PRIVATE_KEYS=4fda40eb4eca4113858b440941953bce0ac10a1b7c2b78cef70c53ee334c9a04,933cc22684708d10f6184245c7fab66e80ed3809d96f1f34ebd8b035fa67dd2d,94f96324f8a230558bb1e2cdc00a0cdf4812e3764a3d04414fb9fffe13307676,420cd36f64e399d5a2493ed85c75a1a7fb3f127105fe1a2f7c270887d3177e28

LOGGING=false
SAVE_DEPLOYMENT=false
REPORT_GAS=true
```

### Compile contracts
Compile the contracts using the command below
 > npm run compile

### Test the contracts
The repo comes with existing tests. To run existing tests run 
> npm run test

To add new tests to the repo,

> touch test/newTest.spec.ts
Edit the contents of `test/newTest.spec.ts`
re-run the tests using 
> npm run test

# Assumptions / Design choices

Following is a list of few key design choices implemented in the architecture. Please keep in mind that issues that closely resemble the below assumptions might be considered invalid.

**1. The admin is a trusted actor**

For the initial stages of the protocol development, the admin is going to be handled by the Sublime core team. Thus, contracts, functions, and critical thresholds are set to be upgradeable by the admin to allow effective action in case of emergencies. Over time, such functions would be decentralized.


**2. Verifiers are trusted actors**

During the initial stages of the protocol development, any verifiers onboarded will be picked by the core team post necessary due diligence. Verifiers handle the mappings of identities to wallet addresses. Thus, users interacting with the Sublime protocol trust the verifiers that they personally utilize to find other members.

**3. Since the loans are undercollateralized, economic loss during liquidations are possible**

Loans that are undercollateralized possess an inherent economic risk - in case of a liquidation event, the lender might not be able to fully recover the funds they deposited.

Collateral thresholds are meant to serve as trigger points after which liquidation actions can be taken - they do not guarantee recovery equal to the pool/credit line’s collateral ratio at the time of creation. This could be due to inaction, front-running, high volatility in asset prices. Thus, collateral ratios serve as benchmarks for lenders to approximately assess the amount of risk they’re taking.

**4. Functions that place requests are susceptible to spamming**

By design, it is possible for anyone to create pools, send/receive credit line requests, send receive address verification or master address linking requests. Thus, while it is possible to spam other users, we expect transaction fees to keep such activities limited. Furthermore, optimizations on the UI will be implemented to handle this.

**5. Oracle prices from Chainlink and Uniswap are considered to be reasonably accurate**

We rely primarily on Chainlink price feeds, but for assets for which price feeds don’t exist, we use Uniswap V3 as a fallback. We expect these feeds to be fairly reliable. Assets will be carefully whitelisted to ensure price manipulations are unlikely.

**7. getTokensForShares() in yield contracts throws division by 0 error when there are no deposits**

The `getTokensForShares()` function is meant to return the number of underlying tokens corresponding to a given LP (share) token (for eg, cTokens). If these functions are called when there are no deposits, a division by 0 error is expected.

**6. Overflow issues in penalty and interest accrual calculations**

To preserve precision, we move to base `10**30` during mathematical calculations. This causes overflow issues in a few places where penalty is calculated (for eg, [this line](https://github.com/sublime-finance/sublime-v1/blob/7fbd3d57f0f447b66f5f78e9926e2f3e05dd9726/contracts/Pool/Pool.sol#L500)) or where interest calculations are made. We have planned corrections for them already.
