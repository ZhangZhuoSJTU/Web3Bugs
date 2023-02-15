# Yeti Finance contest details
- $85,000 USDC main award pot
- $5,000 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-yeti-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 16, 2021 00:00 UTC
- Ends December 22, 2021 23:59 UTC

# Repo Walkthrough

All contracts are in the packages/contracts/contracts folder. All contracts in the contracts/TestContracts folder are not in scope-these are solely for testing purposes and will not be deployed. This includes some contracts that are out of the scope of this contest (details below). This repo also includes robust testing files that may be helpful to understand how the protocol is intended to function. These tests were adapted from Liquity's tests (https://github.com/liquity/dev). However, there may be a couple tests that have not been updated to fit the Yeti Finance protocol.

To run tests, first run ```yarn``` to install dependencies. Then, cd into the packages/contracts folder and run ```npx hardhat test```. You can also run a specifc test file with ```npx hardhat test test/TestingFilename.js```. Thanks and good luck!

These contracts have been labeled with the MIT open-source license by default. However, they are not open source and not in the public domain.

# Protocol Overview 

Yeti Finance is a decentralized borrowing protocol with a stablecoin built on Avalanche. Think of it as Liquity + Abracadabra on steriods. Yeti Finance lets users borrow against their staked assets, LP tokens, and other interest-bearing and base-level assets with zero acccruing interest fees. Yeti Finance allows users to borrow against their entire portfolio at once, reducing the risk that one asset flash crashing would result in liquidation. After depositing their collateral in a smart contract and creating an individual position called a "trove", the user can get instant liquidity by minting YUSD, a USD-pegged stablecoin. Each trove is required to be collateralized at a minimum of 110%. Any owner of YUSD can redeem their stablecoins for the underlying collateral at any time. The redemption mechanism along with algorithmically adjusted fees guarantee a minimum stablecoin value of USD 1.

A liquidation mechanism based on incentivized stability deposits and a redistribution cycle from riskier to safer troves provides stability at a much lower collateral ratio than is typical in the current crypto lending landscape. Stability is maintained via economically-driven user interactions and arbitrage, rather than by active governance or monetary interventions.

# Specific Protocol Systems Summary and Contract Summary

More information about all of these systems in particular are available on our [docs](https://docs.yetifinance.co)

There are some special economic mechanisms to stabilize the protocol compared to a more standard overcollateralized stablecoin lending protocol. If a user’s individual collateralization ratio (ICR = Value collateral / YUSD Debt) falls below 110%, then they are open to liquidations. These liquidations are done through the stability pool, which is an incentivized pool of YUSD which essentially pays back debt of undercollateralized troves, and gets value in collateral back. Another important mechanism implemented is redemptions, which was the idea that one dollar of YUSD can always redeem for one dollar value of collateral from the system. A less commonly used but still important system is redistributions, where if there is not enough YUSD in the stability pool but there is a trove eligible for liquidation, it will redistribute the debt and collateral to other troves in the system. These systems are quite similar to [Liquity's](https://github.com/liquity/dev), but instead use multiple collateral types at once in a single trove. 

Important: To keep track of the different token values in the system we use a system called “VC” or Virtual Coin which takes riskier assets to have less value in the system than safer assets. Essentially it standardizes the value of all the collateral in one user’s trove into one collateral value number. The VC for a collateral depends on a safety ratio which is defined as a risk parameter when adding the token to the whitelist. $VC = Safety ratio * Token amount * Token price in USD. Example: I have 0.75 wMEMO at $8000 dollars with a safety ratio of ⅔. $VC = 0.75 * ⅔ * 8000 = $4000. So, I can take a loan against this $4000 dollars as if it were $4000 of a safe asset with a safety ratio = 1. All troves are eligible to be liquidated when the VC of collateral in the trove falls below 110% of debt on the trove. So with this 4000 VC wMEMO trove, I can borrow up to ~3636.4 YUSD (40000 / 1.10).

In the system, each trove has a tokens and amounts array, where `amounts[i]` corresponds to `tokens[i]` for that token. 

## BorrowerOperations.sol (837 loc)
BorrowerOperations is where users can add/remove collateral, adjust their debt, close their trove, etc. This file has most of the external functions that people will generally interact with. It adjusts the troves stored in TroveManager. 

External Contracts Called: TroveManager, ActivePool, Whitelist, CollSurplusPool, SortedTroves, YUSDToken

Libraries Used: LiquityMath, SafeMath

The main external functions are 
- openTrove() opens a trove for the user. Does necessary checks on the system and collaterals / debt passed in.
- adjustTrove() allows for any action on a trove as long as it stays above the min debt amount, and the ICR is above the minimum. This includes adjusting collateral (adding and removing) as well as taking out our paying back YUSD debt.
- closeTrove() closes the trove by using YUSD from the sender, and returns collateral. This function will automatically unwrap wrapped assets prior to returning them to the sender.

## TroveManager.sol (591 loc), TroveManagerLiquidations.sol (646 loc), and TroveManagerRedemptions (356 loc)
TroveManager handles Liquidations, redemptions, and keeps track of the troves’ statuses, aka all the collateral they are holding, and the debt they have. In Liquity, all this funtionality was in one file called TroveManager.sol. We split it into three because it was too large. The redemptions and liquidations file handle those respective aspects of the protocol, and the main TroveManager handles the general keeping track of the trove. The main external facing functions are 
- batchLiquidateTroves(), called on a list of troves and liquidates collateral from those troves
- redeemCollateral(), which redeems a certain amount of YUSD from as many troves as it takes to get to that amount. 

TroveManager External Contracts Called: ActivePool, DefaultPool, Whitelist, CollSurplusPool, SortedTroves, TroveManagerRedemptions, TroveManagerLiquidations

TroveManager Libraries Used: LiquityMath, SafeMath

TroveManagerLiquidations External Contracts Called: ActivePool, StabilityPool, Whitelist, YUSDToken, TroveManager

TroveManagerLiquidations Libraries Used: LiquityMath, SafeMath

TroveManagerRedemptions External Contracts Called: ActivePool, Whitelist, CollSurplusPool, YUSDToken, Sorted Troves, YETIToken, TroveManager, 

TroveManagerRedemptions Libraries Used: LiquityMath, SafeMath

## StabilityPool.sol (638 loc)
The stability pool is used to offset loans for liquidation purposes, and holding rewards after liquidations occur. Important external facing functions are: 
- provideToSP(), withdrawFromSP(), functions to change the amount of YUSD that you have in the stability pool, and collect rewards. 

External Contracts Called: TroveManager, ActivePool, YUSDToken, SortedTroves, CommunityIssuance, Whitelist

Libraries Used: LiquityMath, SafeMath, LIquidateSafeMath128

## Whitelist.sol (273 loc) 
Whitelist is where we keep track of allowed tokens for the protocol, and info relating to these tokens, such as oracles, safety ratios, and price curves. Has some onlyOwner functions which are secured by team multisig for adjusting token collateral parameters. Also has important getter functions like getValueVC() and getValueUSD() which are used throughout the code. 

External Contracts Called: ActivePool, DefaultPool, StabilityPool, CollSurplusPool, PriceFeed (to get price of a given collateral), ThreePiecewiseLinearPriceCurve

Libraries Used: LiquityMath, SafeMath

## ThreePieceWiseLinearPriceCurve.sol (100 loc)
We are also adding a variable fee based on the collateral type, which will scale up if that collateral type is currently backing too much value of the protocol. The fee system change is discussed further [here](https://github.com/code-423n4/2021-12-yetifinance/edit/main/YETI_FINANCE_VARIABLE_FEES.pdf). To summarize, it is a one time borrow fee charged on the collateral, which will increase based on how much the system is collateralized by that asset. This price curve is where currently this fee is calculated.
- getFeeAndUpdate is called to update the last time and fee percent, only called by Whitelist functions. 

External Contracts Called: None

Libraries Used: SafeMath

## sYETIToken.sol (202 loc)
sYETI is the contract for the auto-compounding YETI staking mechanism, which receives fees from redemptions and trove adjustments. This contract buys back YETI, and adjusts the ratio of sYETI to YETI, adapted from the sSPELL contract. The YUSD Token itself is in the YUSDToken file. Follows ERC20 standard. 

External Contracts Called: YETIToken, YUSDToken

Libraries Used: BoringMath, BoringMath128, BoringERC20

## YUSDToken.sol (226 loc)
YUSDToken follows the ERC20 standard and is our stablecoin which we mint from our protocol. This only allows BorrowerOperations.sol to mint using the user facing functions after respective checks. 

External Contracts Called: None

Libraries Used: SafeMath

## ActivePool.sol (180 loc) 
The Active Pool holds all of the collateral of the system. Handles transfer of collateral in and out, including auto unwrapping assets when called and sending them to a certain sender. 

External Contracts Called: Whitelist, IERC20 contracts to transfer assets, IWAsset contracts to unwrap/send and claim rewards on behalf of user

Libraries Used: SafeMath

## DefaultPool.sol (118 loc)
The default pool holds collateral of defaulted troves after liquidation that have not been redistributed yet. 

External Contracts Called: ActivePool, Whitelist, IERC20 contracts to transfer assets, IWAsset contracts to update rewards

Libraries Used: SafeMath

## CollSurplusPool.sol (116 loc)
CollSurplusPool holds additional collateral after redemptions and liquidations in certain ranges of collateral ratio.

External Contracts Called: Whitelist

Libraries Used: SafeMath

## WJLP.sol (176 loc) (and IWAsset.sol)
We have written wrapper contracts with the intention of them keeping track of staking rewards on behalf of users. For instance, Trader Joe LP Tokens (JLP) can be staked to get rewards in JOE, which is Trader Joe’s token. We allow users to use this wrapped version of JLP that we have made to take out loans on our platform. Though they do not own the tokens that are being staked, the tokens are being staked on their behalfs. When they pull that collateral out, are liquidated, or are redeemed against, they will be eligible for the same JOE rewards to claim as if they had staked themselves. For our protocol, the whitelist keeps track of which whitelisted collateral are ‘wrapped assets,’ because they are handled differently in some cases. Also acts as a normal ERC20

This contract is not well-tested! Just left it in here because it will be a helpful example of the type of thing we intend to do with Wrapped Assets. It is very possible that there are vulnerabilities in the current version of WJLP.sol or tha treward tracking is not done correctly.

External Contracts Called: IERC20 contracts for JOE and Joe LP tokens, MasterChefJoe

Libraries Used: SafeMath

# Areas of Focus 
- General vulnerabilities with multiple assets that may have been overlooked: users should be only able to interact with their own trove, liquidations and redemptions take the correct amount of collateral with edge cases like recovery mode, different safety ratios, etc. 
- Ensure that there is no possibility of reentrancy attacks, exploits with changing token balances, etc. 
- Price manipulation attacks: Ensure that economic attacks like CREAM hack on (an unrelated token to our YUSD) called yUSD was able to drain the entire pool. Since our stablecoin is backed by all the assets in one pool, this could decimate the protocol, and if a backdoor is open then could allow for draining of all collateral funds. We are using our fee system with hard caps to make sure that there is only a certain amount of risky collateral backing the protocol at once. Additionally, there is always incentives for liquidators to call liquidate (0.5% cut of collateral), so some price manipulation attack where a user could take out a lot of YUSD off essentially worthless collateral would be the most dangerous situation.
- Something we have changed significantly and might be good to focus on are the fee system. This fee system is not very battle tested so it may have problems we have not thought about. As mentioned above, we have more detail on fees [here](https://github.com/code-423n4/2021-12-yetifinance/edit/main/YETI_FINANCE_VARIABLE_FEES.pdf)
- Wrapped assets are new as well, and may be good to focus on.
- Gas optimization, our code is quite gas heavy as of now. SumColls and other places where we are looping through all collateral types may a good place to start. 
