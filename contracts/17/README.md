# Gro Protocol contest details
- $100,000 main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-06-gro-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Preview starts June 24 00:00 UTC (no submissions accepted)
- Preview ends June 30 23:59 UTC
- Contest Starts July 1 00:00 UTC
- Contest Ends July 7 23:59 UTC


| Glossary| |
|-------------------------------|------------------------------------------------------|
| PWRD (PWRD Stablecoin)| Rebasing stablecoin, native token of Gro protocol |
| GVT (Gro Vault Token)| Non-rebasing token, native token of Gro protocol |
| Utilisation Ratio| Ratio of PWRD to GVT value in the system |
| Curve pool (LP)| Curve AMM |
| LP (token)| Token that represent share in Liquidity Pool |
| Virtual price| USD price of LP token |
| Yearn Vault or yVault| Stable coin vault that invests into underlying strategies in order to generate yield |
| Sardine, Tuna, Whale| Deposit/Withdrawal sizes ranging from small to large |

# Contest Scope
This contest is open for two weeks to give wardens time to understand the protocol properly. Submissions can only be made in the second week of the contest. Representatives from gro will be available in the Code Arena Discord to answer any questions during the contest period. The focus for the contest is to try and find any logic errors or ways to drain funds from the protocol in a way that is advantageous for an attacker at the expense of users with funds invested in the protocol. Wardens should assume that governance variables are set sensibly (unless they can find a way to change the value of a governance variable, and not counting social engineering approaches for this). 

## Protocol overview
Gro protocol is a yield aggregator built on top of a tranche.

The aim of gro protocol is to offer high yields for users who are willing to take on more risk, and a safer alternative for user who are risk averse. The protocol is able to do so by ensuring that any one of its portfolios exposures, be that to underlying assets or external defi protocols, are kept within a certain threshold.

 - PWRD: 
 A rebasing, yield generating stable coin pegged to the dollar. Its main feature is insurance against any individual protocol/stable coin failure, which it gets from the GVT. In return for this insurance, PWRD hands over part of its yield to GVT. 

 - GVT: 
The risk bearing asset, taking on the risk from PWRD in return for part of PWRD's yield. Unlike PWRD, GVT is not a rebasing stable coin. 

GVT is effectively underwriting the protection of the PWRD and the ratio of PWRD to the value of GVT is referred to as the utilisation ratio. Some yield from the PWRD gets transferred to the GVT based on the utilisation ratio of the two tokens, creating an incentive for the GVT to take on risk from PWRD. On the flip side, a stable coin or protocol failure will first and foremost be paid out from the GVT side, thus preventing PWRD holder from losing any assets in the eventuality of a hack or other issue.

Due to the nature of this relation, the system needs to be able to balance internal assets based on risk exposure to different assets and protocol - the failure of one asset/protocol can impact other assets/protocol and cause the insurance to fail. For this to work, the system gets a set allocation target for stable coin assets, which is the distribution of stable coins the system tries to meet. The investment of these stable coin assets into underlying yield bearing strategies is calculated based on the utilisation ratio of PWRD to GVT.

As profit and loss affects the exposures in the system, it has to measure its changing risk exposure, and in case this exposure is above a predefined margin the system will rebalance itself by swapping out assets.

The system will however try to mitigate this from happening by trying to balance itself whenever it invests or removes assets (large user deposits/withdrawals and system investments) by determining the difference between the target allocations, and the actual assets in the system (this is referred to as the delta), which is used as a basis for understanding how much of each asset needs to be added or removed from the system, continuously pushing it towards a balanced state.

This is all achieved by utilizing Curve as a swapping layer, meaning that the system can make decisions on what assets to move in and out independent of what assets the end user deposits/withdraws.

## Smart Contracts
All the contracts in this section are to be reviewed. Any contracts not in this list are to be ignored for this contest.
A further breakdown of [contracts and their dependencies can be found here](https://docs.google.com/spreadsheets/d/1iwl_WO95_x0lhU7ML5ejRdZ3PiLOWrygBvZJQRTurKc/edit?usp=sharing)

The Protocol is divided into 5 separate modules with different areas of concerns - [System Diagram](https://drive.google.com/file/d/1ueVEEmv19hydELJyLBtso5ksOIsl77lv/view?usp=sharing)

### Control flow [Diagrams](https://drive.google.com/file/d/1gCVQJzzSFLgDAXDK0ZwPg2fRA19CglOS/view?usp=sharing)
The control flow is primarily responsible for stringing the other modules together and user interactions. The controller acts as a hub, providing system level information to other modules. The withdraw and deposit handlers acts as entry points for users withdrawals and deposits respectively.
	
#### Controller.sol (330 sloc each)
Core contract connecting the separate modules, responsible for:

 - Connection Gtokens to protocol
	 - Minting/Burning tokens
	 - Establishing current total assets for pwrd/gvt
 - Allowing other contract to interact with PnL and insurance logic.
 - Access control (may block smart contracts)
 
#### WithdrawHandler.sol (260 sloc each)
 - Contract handling user withdrawals, responsible for:
  - Determining withdrawal logic path [single, balanced, size]
  - Transferring assets from protocol to user

#### DepositHandler.sol (132 sloc each)
Contract handling user Deposits, responsible for:
  - Determining Deposit logic path [small, large]
  - Transferring tokens from user to protocol

#### EmergencyHandler.sol (94 sloc each) (Not in scope)
Alternate withdrawal logic, used in case of curve being compromised, or in the case of the failure of a stablecoin.

### Tokens [Diagrams](https://drive.google.com/file/d/1EVWhZYTtLGddp3SZFT8-ZpvunYClCVEj/view?usp=sharing)

#### GERC20.sol (323 sloc)
Custom implementation of the ERC20 specifications, built ontop of the OpenZepplin ERC20 implementation:
-	_burn: Added parameter - burnAmount added to take rebased amount into account, affects the Transfer event
-	_mint: Added parameter - mintAmount added to take rebased amount into account, affects the Transfer event
-	_transfer: Added parameter - transferAmount added to take rebased amount into account, affects the Transfer event 
-	_decreaseApproved: Added function - internal function to allowed override of transferFrom    

#### GToken.sol (55 sloc)
Base contract for gro protocol tokens. The Gtoken implements a factor that is established as the total amount of minted token over the total amount of assets invested in the token. The factor is then used to drive a desired behaviour in the implementing token.

##### Factor code:
```
function factor(uint256 totalAssets) public view override returns (uint256) {
	if (totalSupplyBase() == 0) {
		return BASE; // 1
	}
	if (totalAssets > 0) {
		return totalSupplyBase().mul(BASE).div(totalAssets);
	}
	return 0;
	}       
```
#### NonRebasingGToken.sol (60 sloc)
Implementation of the GToken contract, used the gtoken factor to establish a price per share, defined as:
```
 function getPricePerShare() public view override returns (uint256) {
    uint256 f = factor();
    return f > 0 ? BASE.mul(BASE).div(f) : 0;
 }         
```
#### RebasingGToken.sol (69 sloc)
Implementation of the GToken contract, used the gtoken factor to establish a balance of, defined as:
```
 function totalSupply() public view override returns (uint256) {
     uint256 f = factor();
     return f > 0 ? totalSupplyBase().mul(BASE).div(f) : 0;
 }
```
### Pricing and Swapping [Diagrams](https://drive.google.com/file/d/1rMx_RK7RsQYLxQXrvtp9skyVgJokN_gV/view?usp=sharing)
The system should have one base currency to calculate total assets based on multiple stable coins (one stable coin has one corresponding VaultAdapter). US Dollar (USD) is used as the base currency. The pricing and swapping modules responsibility is to get the dollar price for stable coins. Safety is the first requirement of this module.

#### LifeGuard3Pool.sol (308 sloc)
The lifeguard is responsible for any stable coin swapping the protocol performs. It interacts directly with the curve3pool. Additionally the lifeguard is responsible for:
 - Handling swaps during deposits and investing assets to stable coin vault adapters
 - Preparing stable coins to be invested for 3Crv, and invested  into the 3Crv vault adapter

#### Buoy3Pool.sol (172 sloc)
The Buoy acts as the protocol pricing oracle, and is responsible for providing pricing and sanity checking curves prices. The Buoy interacts with both Curve (3pool) and Chainlink.
	- Provides prices for rest of protocol
	- Sanity checks Curve prices against historical pricing points
	- Sanity checks Curve against Chainlinks aggregators 

note - The sanity check paramter has been dialed up on kovan to ensure that no transaction get blocked when comparing our mocked 3pool vs chainlink oracle, as the mocked 3pool doesnt experience the natural arb. that the real 3pool would experience.

### Insurance [Diagrams](https://drive.google.com/file/d/1Az4ThISghdIYcbgo6pYWjRqZ_PjLpaFr/view?usp=sharing)
The insurance module is responsible for the system's overall health. It provides functionality for establishing current exposure, and allows the system to route deposits and withdrawals to the correct target vaults. The main insurance functionality is supported by two contracts, allocation and exposure; these are replaceable contracts and act as individual strategies that are depending on the current protocol exposures in the system.

In addition to the core insurance contract, the PnL contract helps the protocol to distribute profit or losses from underlying vaults between GVT and PWRD according to the gro algorithm, and provide the system utilisation ratio (PWRD count / GVT total value).

#### Insurance.sol (340 sloc)
The insurance contract is the most important part of the protocol - it controls the system risk and gets profit from external protocols. Its main responsibilities are:

-   Calculate stable coin / protocol risk exposure
    
-   Rebalance system investment
    
-   Calculate distribution of assets for large deposits and withdrawals
    
The insurance contract shouldn't need to be replaced, as any changes to the protocol (e.g. changes in assets, strategies or protocol exposure) should be captured by the allocation and exposure contracts. These act as strategies for the main insurance contract.

#### Exposure.sol (214 sloc)
Allows the insurance module to calculate current exposure based on the current protocol setup

#### Allocation.sol (186 sloc)
Determines protocol stable coin stable coin, strategy allocations and thresholds based on the current protocol setup. Protocol exposure targets
are defined in the allocation Insurance.

#### PnL.sol (220 sloc)
The Pnl contract holds logic to deal with system profit and loss -It holds a snapshot of latest tvl split between Gvt and Pwrd, and updates this value as deposits/withdrawal, gains/losses etc occur. The following action can impact the systems TvL: 
	-	deposits/withdrawal: updates to TvL are handled through the control flow module (on user deposit/withdrawal)
	-	Yields (Strategy Gains/losses): reported back to the PnL contract during a harvest (realisation of yield)
	-	Holder bonuses: A fee taken from users on withdrawals and distributed to other protocol holders. This is realized on withdrawals
	-	Price changes: As the TvL is determined by by curves pricing. Price changes are realised during harvests, and only affect the GVT tokens total assets (independently if the realized price difference causes a gain or loss)

### Vaults and Strategies [Diagrams](https://drive.google.com/file/d/1hQHTY_tDFW5TYzgqyFb8IpZzP0LdSSaZ/view?usp=sharing)

#### BaseVaultAdaptor.sol (348 sloc)
Abstract contract containing additional logic that needs to be built ontop of any vault in order for it to function with gro protocol

#### VaultAdaptorYearnV2_032.sol (158 sloc)
Implementation of the vault adapter to interact with a modified version of the yearnV2 Vault

### Common contracts
Standard abstractions implemented by other contracts in the protocol

#### Whitelist.sol (21 sloc)
Access control logic
		
#### Controllable.sol (34 sloc)
Contracts relying on the Controller.sol contract
		
#### StructDefinitions.sol (37 sloc)
Defintions of structs used in the protocol
	
#### Constants.sol (11 sloc)
Constant values used accross the protocol:
	- Decimal constants
	
#### FixedContracts.sol (81 sloc)
Immutable and constant variables used accorss the protocol. Divided into:
	- Fixed GTokens (pwrd, gvt)
	- Fixed Stablecoins (DAI, USDC, USDT)
	- Fixed Vaults (gro protocol stablecoin vaults)

## Additional protocol information
#### Pricing
The protocol works with three stable coins, and relies on the curve 3pool in order to price these assets to a dollar value. The protocol uses the dollar value of its stable coin assets to determine TVL, gains/losses etc. 

 - Curve prices are tightly checked whenever an interaction is done against curve. Cached prices are used to compare values of previous against current interactions to ensure that curves price hasnt been manipulated.
 - Curves price is cached whenever strategies are harvested, this cached price is used as a reference point until the next time a strategy is harvested (Buoy3Pool.sol:updateRatios)
 - 3 chainlink usd/stablecoin aggregators are used to sanity check curves price whenever a new price is cached.
 
#### Profit and loss
Profit and losses are kept track of in the PnL contract. The PnL contract holds the total dollar value locked in Gvt and Pwrd, which changes based on user interactions and system wide gains/losses. The protocol recognises three sources of profit/loss:
 - User withdrawal fees
	 - All withdrawals are subjected to 50 BP withdrawal fee, this fee is distributed to both Gvt and Pwrd holders
 - Strategy Gains/losses
	 -   Realized when the strategyHarvest function is called in a vaultAdaptor. If its a gain, it is distributed to pwrd and gvt holders based on the utilisation ratio. If it is a loss, it gets absorbed by Gvt.
 - Price changes
	 - The underlying price of the three stable coin assets fluctuate over time. While any deposit/withdrawal is done at curves current spot price, tvl for pwrd and gvt looses accuracy over time. To compensate for this,  the protocol determines the change in current tvl vs previous tvl during a harvest. Any potential gains/losses attributed to price changes only affects Gvt.

#### User interaction
User interaction start in either the deposit or withdraw handler. A user is treated differently depending on the size of the user and the type of interaction the user is doing, user interactions can be broken down in the following groups:

#### Deposits:		 
 - Sardines (small deposits)
	 - A sardines deposit gets sent directly to the vault adapter, independently of what asset was deposited. 
	 - The value of the deposit is estimated using curves calc_token_amount function, multiplied by the curve pool virtual price to get a dollar value. This value is used to determine how many token get minted to the user 
 - Tunas (medium deposits)
	 - For medium sized deposits, the system will perform a swap if the deposited assets corresponds to the protocol most over exposed asset
	 - the swap will be from most overexposed to least exposed
 - Whales (Large deposits)
	 - The users deposited assets will be put into the curve 3 pool and withdrawn in a ratio that matches the protocols target allocations
	 
#### Withdrawals:	
##### Single asset withdrawals:
Withdrawals are divided into the same three sizes as deposits, and similarly determines if the protocol will pull out another assets and swap it into the users desired asset. Sardines being the simplest, pulling out assets from the vault adapter matching the desired asset directly. Tunas attempting to pull out of the least exposed vault adapter, but may pull from multiple vault adapters and perform swaps to match the users desired asset and whales pulling from all vault adapters, guaranteeing a swap into the users desired asset.
##### balanced withdrawals
Withdrawals also provide a cheaper alternative for larger withdrawals, where the user can withdraw a balanced set of assets, balanced being defined by the protocol as the difference between its current assets distribution, and its desired distribution. This Benefits the protocol immensely, as it helps keep the exposure rates stable, and also benefits the user by being significantly cheaper than doing a large single sided withdrawal as no swaps occur.

#### Lifeguard skim logic
On top of its 3 stable coin vaults, the protocol also leave a small amount of any larger deposit in the lifeguard any time assets pass through. Once there is a critical mass of assets in the lifeguard, these assets can be deposited into the curve3pool for 3Crv tokens, which in turn are invested into a 3crv vault. The logic for handling 3Crv tokens and curve exposure is different than the stable coins, as 3Crv create additional exposure towards all 3 stablecoins, so the protocol needs to regulate its curve exposure a bit more tightly.

## Potential Protocol concerns
#### Pricing oracle:
 - Gro protocol relies on curve for pricing, historically we know that curve is easy to manipulate. In order to combat manipulation we utilize a cached of curve prices, which is compared to curve current spot price any time an interaction against curve is performed. The caching is attempted every time a harvest is run, the caching itself is sanity checked against chain link, and the cache is not updated if there is to large a difference between curves and chain links price. Even though we've taken precautions, this would likely be the most obvious attack vector
#### Curve min amount
 - When interacting with curve, we rely on the aforementioned price cache to not get sandwiched exposed to front running. Min amounts against curve interaction are generally set to 0, which could be another potential attack vector.

## Areas of concern for Wardens
We would like wardens to focus on any core functional logic, boundary case errors or similar issues which could be utilized by an attacker to take funds away from clients who have funds deposited in the protocol. That said any errors may be submitted by wardens for review and potential reward as per the normal issue impact prioritization. Gas optimizations are welcome but not the main focus of this contest and thus at most 10% of the contest reward will be allocated to gas optimizations. For gas optimizations the most important flows are client deposit and withdrawal flows.

If wardens are unclear on which areas to look at or which areas are important please feel free to ask in the contest Discord channel.

## Tests
A full set of unit tests are provided in the repo. To run these do the following:
## Prepare local enviroment

1. install `nodejs`, refer to [nodejs](https://nodejs.org/en/)
2. install `yarn`, refer to [yarn](https://classic.yarnpkg.com/en/)
3. install `vyper`, refer to [vyper](https://vyper.readthedocs.io/en/stable/installing-vyper.html)

### install vyper for mac
``` shell
brew install pyenv
echo -e 'if command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> ~/.bash_profile
Restart shell
pyenv install 3.6.12
pyenv global 3.6.12
pip3 install vyper
```

1. run `yarn install` in workspace root folder
2. run `npx hardhat test` command in terminal


## Testnet deployment
A working instance of gro protocol has been deployed on Ropsten. All external contracts, with the exception of chain links aggregators, have been mocked. Strategies and underlying vaults are included in the deployment to aid testing and analysis, but are outside the scope of this contest. Yields are mocked and generated on a regular basis. Bots are triggering Harvests any any other actions that are used to maintain the protocol. Mint functionality is open for all stable coins, and users are welcome to use and play around with the protocol. But if you want to do do an extensive amount of interactions with the protocol, such as large trades which may impact the balance of the Curve pool, we would kindly ask you to do so on a fork.

_Call the faucet() method on the stablecoins to claim 10k coins per address._

[ropsten ETH faucet](https://faucet.ropsten.be/)

 The following mocked contracts are used by the protocol on Ropsten:
| Mocks                         | Address |
|-------------------------------|------------------------------------------------------|
| DAI	                        | [DAI, '0xBad346b9d0f4272DB9B01AA6F16761115B851277'](https://ropsten.etherscan.io/address/0xBad346b9d0f4272DB9B01AA6F16761115B851277#writeContract), |
| USDC	                        | [USDC, '0xa553CdA420072A759aC352DCa4CeC70709829614'](https://ropsten.etherscan.io/address/0xa553CdA420072A759aC352DCa4CeC70709829614#writeContract), |
| USDT	                        | [USDT, '0xed395510B7a2299f8049bcAcb6e9157213115564'](https://ropsten.etherscan.io/address/0xed395510B7a2299f8049bcAcb6e9157213115564#writeContract), |
| Curve3Pool                    | [Curve3Pool, '0x930e1D35BeF80A1FF7Cb70DcFf295Ed97D187c58'], |
| 3Crv                          | [3Crv, '0xF92594660CAE88FC36C63d542266eA57575a08BC'], |


The following external contracts are being used
| External                         | Address |
|-------------------------------|------------------------------------------------------|
| DAI/USD Aggregator (Chainlink)| [DAIUSDAggregator, '0x1cE5b46220546276c3EA96e120F2071825a795a5'], |
| USDC/USD Aggregator (Chainlink)| [USDCUSDAggregator, '0x78670902A9fb64d9F82BC9672c5FbF29c08ec29D'], |
| USDT/USD Aggregator (Chainlink)| [USDTUSDAggregator, '0x182280A3A797EcD063de629C818aE392306a936D'], |


The following contracts make up the core protocol on Ropsten.
| Protocol                         | Address |
|-------------------------------|------------------------------------------------------|
| Controller| [Controller, '0xBA0E31cfED0e7B49Cc691c3019566C59a96c4c24'], |
| DepositHandler| [DepositHandler, '0x4246529D7168FE98F0530d99d93d346092bf50F1'], |
| WithdrawHandler| [WithdrawHandler, '0x50B325c2d97CfC88c79E051d2d2A9E3D9C0ac3A8'], |
| Gvt| [NonRebasingGToken, '0x4394be2135357833A9e18D5A73B2a0C629efE984'], |
| Pwrd | [RebasingGToken, '0xCAdC58879f214a47Eb15B3Ac6eCfBdC29fb17F28'], |
| Insurance| [Insurance, '0xc1658e21316123C5aF064C70B22Ee74beb022652'], |
| Exposure| [Exposure, '0xB6D963744DD32297CB6cE8976dF347f945f20c6c'], |
| Allocation| [Allocation, '0x02f214aA535f3280eD921A4000aED02b28491D1D'], |
| PnL| [PnL, '0x6E50c4d3b3917a4aa4196F4F90C2533C2d2e1634'], |
| LifeGuard3Pool| [LifeGuard3Pool, '0x5665e00A1fb8Df60d0DE11077D2971641D3c284c'], |
| Buoy3Pool| [Buoy3Pool, '0xE524f817F06350EA6613AF7896f62AABE735c967'], |
| DaiVaultAdapter| [VaultAdaptorYearnV2_032, '0xF239120f6197c289f662369dd1B1Bf236140f3Df'], |
| UsdcVaultAdapter| [VaultAdaptorYearnV2_032, '0x1Af03157a5d3cC3c8FE02199090445b13dE99734'], |
| UsdtVaultAdapter| [VaultAdaptorYearnV2_032, '0x2095213E61Cb34532923Aa11D2Bc6E4E63e7A188'], |
| 3CrvVaultAdapter| [VaultAdaptorYearnV2_032, '0x1Fb3d9E038CF42e2c62fe6d9Ca82b1b197FC62a2'], |
