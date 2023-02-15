# Sublime Code4rena Contest Details

- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-sublime-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 29, 2022 00:00 UTC
- Ends March 31, 2022 23:59 UTC

# Overview

Sublime is a decentralized protocol for building and accessing credit. Borrowers can use Sublime to create fully-customizable loan pools or credit lines, allowing them to utilize their social capital to borrow undercollateralized loans from lenders that trust them. The protocol has been developed with the idea of trust minimization - a lender’s capital is only utilized by borrowers they trust. Integration with overcollateralized money markets like Compound enables lenders to generate passive yield on their assets for times when users they trust aren’t actively borrowing. Sublime also features a flexible identity verification module which allows users to link their identities to their wallet addresses to bootstrap their on-chain reputation.

For more information and technical specs, please refer to the [documentation](https://docs.sublime.finance/).

To learn more, please join the [Sublime Discord server](https://discord.gg/cnadj5hFwh).

# Audit Scope

Please note that the contest duration is 3 days.

The scope includes the following files, which are a part of [0.0.7 release](https://github.com/sublime-finance/sublime-v1/releases/tag/0.0.7):

- [sublime-v1/contracts/PooledCreditLine/PooledCreditLine.sol](https://github.com/sublime-finance/sublime-v1/blob/46536a6d25df4264c1b217bd3232af30355dcb95/contracts/PooledCreditLine/PooledCreditLine.sol)
- [sublime-v1/contracts/PooledCreditLine/LenderPool.sol](https://github.com/sublime-finance/sublime-v1/blob/46536a6d25df4264c1b217bd3232af30355dcb95/contracts/PooledCreditLine/LenderPool.sol)
- [sublime-v1/contracts/Verification/twitterVerifier.sol](https://github.com/sublime-finance/sublime-v1/blob/46536a6d25df4264c1b217bd3232af30355dcb95/contracts/Verification/twitterVerifier.sol)

The main focus of this audit are the first two contracts, which is a new type of loan product we're introducing called Pooled Credit Lines. Pooled Credit Lines allow the creation of generalized loan offerings. It allows a borrower to raise a line of credit from multiple lenders. Capital from lenders is pooled together, and any unused capital is supplied onto a passive yield strategy such as Compound chosen during the creation of the loan. Participation of lenders in the loan can be restricted by the borrower by choosing a verifier that matches their requirements.

The third contract is a verifier used to verify user's Twitter IDs. Verification involves a combination of on-chain and off-chain steps. All verifiers involve the following general flow:

1. User requests verification
2. User posts a tweet containing a signed message
3. Verification of the signed message occurs off-chain using a bot
4. If the message is successfully verified, user executes a transaction that adds their details to the contract. Parts of the argument necessary to execute the transaction are provided by the verifier

Additional details (overview as well as technical spec) can be found in our [documentation](https://docs.sublime.finance/). 

# Assumptions / Design choices

Following is a list of few key design choices implemented in the architecture. Please keep in mind that issues that closely resemble the below assumptions might be considered invalid.

**1. The admin is a trusted actor**

For the initial stages of the protocol development, the admin is going to be handled by us. Thus, contracts, functions, and critical thresholds are set to be upgradeable by the admin to allow effective action in case of emergencies. Over time, such functions would be decentralized.

**2. Verifiers are trusted actors**

Verifiers are picked after necessary due diligence is completed. Verifiers handle the mappings of identities to wallet addresses. Thus, users interacting with the Sublime protocol trust the verifiers that they personally utilize to find other members.

**3. Since the loans can be undercollateralized, economic loss during liquidations are possible**

Loans that are undercollateralized possess an inherent economic risk - in case of a liquidation event, the lender might not be able to fully recover the funds they deposited.

Collateral thresholds are meant to serve as trigger points after which liquidation actions can be taken - they do not guarantee recovery equal to the pool/credit line’s collateral ratio at the time of creation. This could be due to inaction, front-running, high volatility in asset prices. Thus, collateral ratios serve as benchmarks for lenders to approximately assess the amount of risk they’re taking.

**4. Functions that place requests are susceptible to spamming**

By design, it is possible for anyone to create loan requests, send receive address verification or master address linking requests. Thus, while it is possible to spam other users, we expect transaction fees to keep such activities limited. Furthermore, optimizations on the UI will be implemented to handle this.

**5. Oracle prices from Chainlink and Uniswap are considered accurate**

We rely primarily on Chainlink price feeds, but for assets for which price feeds don’t exist, we use Uniswap V3 as a fallback. We are assuming these feeds to be reliable. Assets will be carefully whitelisted to ensure price manipulations are unlikely.

**6. The system configuration of all the contracts including all the global variables and system parameters are assumed the be deployed without anyone able to frontrun**

Cases of frontrunning initializations can be handled by redeploying the contracts.

**7. In cases where a verification by a verifier is revoked in the middle of an active loan, the loan can be terminated prematurely by the admin**

**8. The PooledCreditLine.sol contract exceeds the contract code size under the current release. This issue has been fixed, although the fix is not ready for this release**
