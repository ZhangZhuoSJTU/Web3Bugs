## Introduction

Yield Protocol v2 provides for collateralized fixed-rate, fixed-term loans on Ethereum. Users can provide a variety of different collateral types to borrow a variety of assets at fixed-rates. The [Yield Protocol Whitepaper](https://yield.is/YieldSpace.pdf) further describes the high-level design and motivation of the system.

To enable fixed-rate, fixed term loans, Yield Protocol uses a class of tokens called *fixed yield tokens*, or *fyTokens* for short. fyTokens are Ethereum-based tokens (ERC20) that may be redeemed one-for-one for a target asset after a predetermined maturity date. 

fyTokens are analogous to zero-coupon bonds. A zero-coupon bond is a debt security that does not pay interest but instead trades at a discount, rendering a profit at maturity, when the bond is redeemed for its full face value. The interest rate is calculated by the difference between the discounted value and the underlying's value at maturity.

Each fyToken has a maturity date and an associated underlying asset. A holder of a fyToken may redeem the fyToken for the underlying asset one-to-one after the maturity date. For example, if a user has a fyDai token, after the maturity date, they may redeem the fyDai token for one Dai. 

*At maturity, fyDai are redeemable for Dai one to one*


To borrow, you deposit collateral in the protocol and draw new fyTokens against the collateral. You may proceed to sell the fyTokens for the underlying token, locking in your borrowing rate. Yield Protocol v2 has a built-in automated market maker(AMM) called YieldSpace to enable efficient selling of fyTokens. 


**Borrowing Process**

At maturity, you must repay the debt to reclaim your collateral. Of course, you may also repay your debt earlier than the maturity by returning the fyTokens you have drawn. Interest rate changes may affect (positively or negatively!) the amount of the borrowed asset you need to spend to obtain the needed fyTokens. After maturity, there is not requirement to close a borrowing position, however, interest is charged to keep the position open. 

Lending in Yield Protocol is as simple as purchasing fyTokens from our YieldSpace AMMs at a discount. The discount received determines the interest rate you receive. After maturity, lenders may redeem their fyTokens for the underlying token one-to-one. fyTokens may be redeemed anytime after maturity. To compensate lenders who do not redeem fyTokens right away, after maturity they begin earning interest in the form of an increasing redemption rate. 

While fyTokens are ERC-20 assets and can be traded using existing protocols like Uniswap, those protocols are not optimized for fyTokens. To improve the liquidity of fyTokens, Yield has designed a new protocol for automated liquidity provision that is designed to enable efficient trading between tokens and their fyTokens. We call this new protocol YieldSpace. You can read more about YieldSpace in our [YieldSpace whitepaper](https://yield.is/YieldSpace.pdf).

Like other AMMs such as Uniswap, YieldSpace AMMs require liquidity providers that provide liquidity to buyers and sellers of fyTokens. Each fyToken has an associated YieldSpace AMM contract that permits trading between that fyToken and it’s underlying asset. 
## Smart Contracts Overview

At the core of Yield are user-owned **vaults** representing a collateralized debt position. Each vault is associated with a single collateral, and debt in a single series. A series represents a single borrowable asset with a defined maturity date. For example, Alice may own a vault with ETH collateral and debt in the USDC0625 series. The  USDC0625 series represents an obligation to repay USDC on June 25th, 2021. 

At the core of Yield Protocol is the **Cauldron**, a smart contract that records the collateral and debt for users. Collateral and debt are kept in vaults which may be owned by a particular address. Cauldron permits management of the full lifecycle of a vault, from creating a vault, adding and removing collateral, adding and removing debt, checking collateralization, permitting liquidation of undercollateralized vaults, and rolling collateral and debt to a new series. 

Debt in Yield is tokenized in the form of fyTokens (“fixed yield tokens”). fyTokens are ERC-20 tokens that are redeemable one-for-one upon reaching a maturity date. Thus fyUSDC0625 tokens are redeemable for USDC after June 25th, 2021. Each fyToken maturity has an associated **FyToken** ERC-20 smart contract. 

Each type of collateral in Yield may be sequestered into a holding contract, or **Join**, for that collateral. Join contracts receive assets from users and store it until it is removed from the system. Join does not record any vault state. Join permits users to flash borrow all assets it holds. 

User activity in Yield is orchestrated by the **Ladle** contract. High-level actions in Yield Protocol are performed by composing smaller discrete actions in the protocol into batches that can be executed in single transactions. The Ladle contract provides a mechanism for batching transactions called **batch**, naturally. Each batching transaction function takes a set of batched actions, and calls Ladle member functions associated with each action. 

To ensure that vaults are properly collateralized, Yield has various **Oracle** contracts. These contracts wrap external oracles, like Chainlink or Uniswap TWAP oracles. 

If users fail to maintain the appropriate level of collateral, they may be liquidated via **Witch**, Yield’s liquidation engine. Witch permits anyone to kick off the liquidation process for an undercollateralized vault. Liquidation is performed via an increasing price auction that increases the amount of collateral the system is willing to pay to cover the debt. 

Yield includes an internal AMM to provide liqudity for fyTokens. The AMM is called YieldSpace. 

YieldSpace is implemented in the **Pool** contract. A **PoolRouter** contract manages calls to and from the pool. YieldSpace pools are designed to trade in interest rates space. That means that the pool will quote trades at the same marginal interest rate over time, absent any trading activity (that would change the interest rate). 



## Utility Contracts
### AccessControl
- Function roles and admin roles
- `auth` and `admin`
- ROOT and LOCK

The access control contract was adapted from OpenZeppelin's AccessControl.sol and is inherited from most other contracts in the Yield Protocol.

A role exists implicitly for each function in a contract, with the ROOT role as the admin for the role.

If the `auth` modifier is present in a function, access must have been granted to the caller by an account with the admin role for the function role. This admin role will usually be ROOT, but that can be changed. 

An `admin` modifier exists to restrict functions to accounts bearing the `admin` role of a given other role. This is not used outside AccessControl.sol.

An account belonging to the admin role for a function can grant and revoke memberships to the function role.

The ROOT role is special in that it is its own admin, so that any member of ROOT can grant and revoke ROOT permissions on other accounts.

There is a special LOCK role, that is also admin of itself, but has no members. By changing the admin role of a function role to LOCK, no further changes can ever be done to the function role membership, except users voluntarily renouncing to the function role.
### ERC20 and ERC20Permit
The Yield Protocol uses its own implementation of ERC20 contracts, which borrow heavily from the DS-Token implementation. The ERC2162 extension is taken from WETH10, which was taken in turn from Yield v1.
## Vault Contracts
The Yield Protocol is divided in two repositories, one for the collateralized debt engine, and one for the automated market maker.

### Oracle
The Yield Protocol uses its own Oracle interface as a wrapper to external oracles, so that it is possible to switch to external oracles with arbitrary interfaces with no impact to the core contracts.

The IOracle interface offers a `get(bytes32 base, bytes32 quote, uint256 amount) returns (uint256 value)` function that accepts base and quote identifiers and an amount of `base` to convert according to them and to the value returned by the external oracle.

`peek` is the same as `get`, but for oracles that offer non-transactional readings.
#### Spot oracles
Spot oracles return the `value` of an `amount` of `base` in `quote` terms. We use these to determine the collateralization level of vaults.
#### Rate and chi oracles

To charge borrowers for maintaining a borrowing position after maturity, Yield charges interest. The interest is determined by an oracle called the ‘rate’ oracle. Likewise, to compensate lenders who leave fyTokens unredeemed, fyTokens increase in redemption value after maturity based upon an oracle called the ‘chi’ oracle. 

Rate and chi oracles return the `value` of an `amount` multiplied by the borrowing and lending rates for `base`, respectively. These rates we currently get from Compound cTokens. We use these oracles to determine the debt of vaults after maturity, and the redemption value of fyToken after maturity.
#### Multioracles
Multioracles store multiple sources of the same type in a single contract, to reduce deployment costs.

### Join
Join contracts hold ERC20 and other assets that are external to the Yield Protocol, but that we manage as collateral or underlying.

We deploy one Join for each asset (collateral or underlying) that is accepted in the Yield Protocol. The Ladle keeps a registry of these Joins and is the only contract or account with permissions to move assets in or out of a Join.

The Join contract keeps track of the assets it should be holding, instead of relying on checking its balance at the asset contract. This allows to remove the need for approvals in the integration with other contract.

#### Join
The `join` function takes assets from the specified account. If there are any unaccounted assets already in the Join, these are used before transferring from the user.

#### Exit
Transfer an amount of asset to the given address.

#### Retrieve
Transfer an amount of any ERC20 other than asset to the given address, to enable airdrops to the Join.

#### Flash loans
The Join can serve as a lender for ERC3156 compliant flash loans of the asset it holds.

#### Join Factory
To reduce the deployment size of Wand to under 24Kb, Joins are deployed through a Join Factory.

### FYToken
FYTokens are ERC20 zero coupon bonds, redeemable at maturity for the underlying specified on deployment.

Redemptions can be executed at or after maturity. In a redemption, the fyToken will be burnt and the underlying asset will be sent to an user on a one-to-one basis.

The fyToken for redemption needs to either have been approved by the caller, or needs to have been transferred to the fyToken contract. If transferring, the `transfer` and the `redeem` should happen in the same transaction.

On the first redemption, or the first time that `mature` is called, the chi oracle is read to record the chi value at maturity. On any subsequent redemptions the chi oracle is read to calculate the chi accrual, defined as `current chi / chi at maturity`.

The amount of underlying transferred on redemption is the amount of fyToken redeemed multiplied by the chi accrual.

On redemption, fyToken instructs the Join for the underlying to transfer the underlying to the target account. 

The `mint` and `burn` functions are restricted, and only the Ladle can call them. It does so when issuing or repaying debt.

Can be flash minted with no fees following the ERC3156 standard.

For a given underlying, such as Dai, there would be a fyToken contract for each maturity. If, for example, we decide to have quarterly maturities for Dai in 2022, we would deploy 4 fyDai contracts: 31/03/21, 30/06/21, 30/09/21 and 31/12/21.

### Cauldron
The Cauldron is the debt and collateral accounting system for Yield v2.

#### Vaults
User debt and collateral are recorded in numbered vaults, so that each account can have multiple independent positions. A series of a fyToken is a specific ERC-20 contract that has a maturity time and an underlying or “base” asset. Vaults permit an owner to provide a single kind of **collateral** to borrow a single **series** of fyTokens. Vaults can be created, modified, transferred or destroyed.

Each vault is linked to a single series and a single ilk. A series is a fyToken contract with associated data. An ilk is an asset that is used as collateral.

The vault data is divided into two separate structs, both accessible through the vaultId: Vault and Balances.

DataTypes.Vault records the owner, seriesId and ilkId.

DataTypes.Balances records the vault debt (art) and vault collateral (ink). You use ink to draw art.
#### Stir and pour
`stir` moves collateral and debt between vaults. It can only move debt or collateral between vaults with matching seriesId or IlkId, respectively.

It can be used along `build` and `destroy` to split and merge vaults.

`pour` is used to add and remove debt and collateral to vaults. It underpins borrowing and repaying.

`stir` and `pour` will revert if any affected vaults would be undercollateralized at the end of the transaction.
#### Debt after maturity
The debt of a vault is stored in fyToken terms, and only ever changes through user action. 

However, if the debt is expressed in underlying terms, it increases after maturity through applying a borrowing rate obtained from the rate oracle for the underlying.

A different way to look at this mechanism

- 1 fyDai of debt can always be repaid always with 1 fyDai
- 1 fyDai of debt can be paid with 1 Dai before maturity, or 1 Dai \* rate\_accrual after maturity, where `rate\_accrual = borrowing\_rate\_now / borrowing\_rate\_at\_maturity` 
#### Collateralization
All vaults need to remain collateralized, or they will be at risk of liquidation.

A vault is collateralized if the value of its collateral is greater than the value of its debt by a factor equal to the collateralization ratio of the underlying and collateral pair.

`ink \* price \* ratio >= art \* rate\_accrual`

#### Liquidations
For the protocol not to go bankrupt, it must act when the value of the collateral in the vaults risks being lower than the debt owed by the vaults.

Liquidation engines are given access to the Cauldron to resolve the situation. Any undercollateralized vault can be sequestered by a liquidations engine using `grab`. At that point the vault effectively belongs to the liquidations engine.

For a period of time, defined as `auctionInterval`, the liquidations engine can run its own algorithm to sell the collateral in the vault for underlying. If the collateralization ratio was over 100%, this sale can happen at a profit to the liquidations engine.

At the end of the collateral auction, the liquidations engine will return any obtained underlying to the appropriate Join, and instruct the Cauldron to return the vault to its owner, with the debt reset to zero, and an amount of collateral that depends on the outcome of the auction.

Liquidation engines can have multiple implementations, but they must be approved by the Cauldron before they can operate.
#### Protocol Debt
The Cauldron also records the protocol debt (DataTypes.Debt.debt) for every underlying and collateral pair.

As users borrow from a given series, the debt is accounted in the protocol totals as the underlying from the series and the collateral that was used. 

There are ceiling debt limits (DataTypes.Debt.max), and the Cauldron will reject registering any debt that surpasses them.

#### Other
The only external dependencies from Cauldron are towards rate oracles and spot oracles.

All transactional functions require privileged access.

One contract deployed.
### Witch
The Witch is a Liquidations Engine, one of many possible implementations. Currently it is the same implementation as for Yield v1, refactored.

The Witch grabs uncollateralized vaults, replacing the owner by itself. Then it sells the vault collateral in exchange for underlying to pay its debt. The amount of collateral given increases over time, until it offers selling all the collateral for underlying to pay all the debt. The auction is held open at the final price indefinitely. 

After the debt is settled, the Witch returns the vault to its original owner.

Calls the Ladle to move assets, and the Cauldron to obtain and release control of undercollateralized vaults.
### Ladle
The Ladle is a routing and asset management contract for Yield v2. It can be upgraded through Modules, or replaced wholesale. It has considerable privileges and is the largest contract in the protocol.
#### Cauldron
The Ladle is the only contract that is authorized to make changes to the accounting in Cauldron.

The Ladle is as well the only contract that is authorized to create, modify or destroy Vaults in the Cauldron.

#### Joins
The Ladle keeps a registry of Joins and it is authorized to move assets from any Join to any account. The Ladle also moves assets from users to Joins, with allowances approved by the users.
#### FYToken
The Ladle is authorized to mint fyToken at will. The Ladle also moves fyToken from users to FYToken contracts for burning, with allowances approved by the users.

The Ladle knows about all the existing fyToken through the series registry in the Cauldron.
#### Pools
The Ladle keeps a registry of all the Pools, indexed by the id of the series traded. The Ladle also moves assets from users to Pool contracts for trading, with allowances approved by the users.
#### Pour
The Ladle uses the integrations and authorizations described above to provide collateralized debt features.

When a user wants to deposit collateral and borrow a fyToken, the Ladle will `pour`:

1. Take the collateral from the user to the appropriate Join.
1. Register the position in the Cauldron.
1. Mint the fyToken in the user’s account.

Similarly, a user can repay debt and withdraw collateral with `pour`.

1. Take the fyToken from the user, and burn it.
1. Register the new position in the Cauldron.
1. Transfer the collateral from the Join to the user.
#### Close
Users can also pay their debt with the underlying asset for the debt, instead of with fyTokens. While the debt in fyToken terms only changes through borrowing actions, the debt in underlying terms changes according to the matching rate oracle. The Ladle will get the rate accrual from the oracle through the Cauldron, and adjust asset transfers and recorded positions accordingly.
#### Stir
Users can move collateral and debt between Vaults through the Ladle using `stir`. Combined with the creation and destruction of Vaults, this can be combined to split a Vault in two, or to merge two Vaults into one.

#### Other Features
- Serve: Borrow and trade the fyToken for underlying, effectively borrowing at a fixed rate.
- Roll: Migrate debt between two series.
- Repay: Trade underlying for fyToken, in order to pay debt.
- Repay Vault: Trade underlying for fyToken, in order to pay exactly all the debt in a vault.
- Remove and Repay: Remove liquidity from a YieldSpace pool, and use the obtained fyToken to repay debt, if it exists.
- Transfer to Pool and Route: Move assets from the user to a pool, and execute a function in the latter. Can be used to sell underlying, effectively lending at a fixed rate.
- Transfer to fyToken and Redeem: Move assets from the user to a fyToken, and redeem them for underlying. This can be used to roll a mature lending position.
- Permit management: Execute a Dai or ERC2162 off-chain permit.
- Ether management: Convert to WETH, or from WETH.

#### Settle
Settle is a restricted convenience function to allow the Witch to use the Joins, without setting individual permissions. It is used when liquidators buy auctioned collateral with underlying, to move the assets.
#### Batch
Any number of actions can be batched in a single transaction using the Ladle, and in reality batches are the only entry point to the Ladle.

Instead of using the popular “multicall” pattern, we have implemented a “switch” pattern that avoids external calls when batching, and allows us to cache the Vault that is being operated upon between actions.
#### Modules
The Ladle can be extended by the use of modules. The Ladle can `delegatecall` functions in modules that have been authorized via governance. The Modules can inherit from LadleStorage to read and modify the Ladle storage, although modifying it is discouraged.
### Wand
Bundling of discrete governance actions into useful governance features.

- Add asset
- Make base
- Make ilk
- Add series
## YieldSpace Contracts
The implementation of YieldSpace for Yield v2 is a refactor of the Yield v1 implementation, generalized to allow markets with any underlying, and optimized for lower gas costs on liquidity providing operations.
### Math64x64
YieldSpace uses ABDK's Math64x64 library, which we have upgraded to 0.8.

### YieldMath
YieldMath.sol uses Math64x64 to implement YieldSpace as described in the whitepaper. We use the same curve implementation from Yield v1, but refactored to make the math clearer.

The functions implemented in YieldMath are buyBase, sellBase, buyFYToken and sellFYToken.
### Pool
The Pool contracts are a DEX implementation very much in the style of Uniswap v2, but using YieldMath to calculate the trades.

This Pool v2 implementation is a refactor of Pool v1 which adds a time weighted average rate (TWAR) oracle, single-asset mint and burn, and removes all `transferFrom` in favour of keeping track of balances.
#### Liquidity
To function, each Pool must keep a balance of the two assets it trades: One underlying asset (or base) and one fyToken. The marginal interest rate currently offered by the Pool is determined from the relative levels of the reserves of the underlying asset and the fyToken. 

In order to build up these balances, liquidity providers can provide assets using `mint`, receiving pool tokens in exchange. Pool token holders can `burn` them to receive their assets back, plus a proportion of the pool growth that can be attributed to trading fees.

When providing liquidity, assets must be provided in the same proportion as the pool balances, thus a liquidity provider is required to provide precise amounts of underlying and fyToken. When a Pool has exactly zero fyToken, only underlying is provided to `mint`. This is the state when a Pool is first deployed. The initial fyToken balance must come from someone selling fyToken to the Pool.

In a Pool the fyToken balances must always be higher than the underlying balances for the curve not to go into negative territory. This means that there is always an amount of fyTokens that cannot be purchased. An optimization already present in Yield v1 is that the supply of pool tokens is added to the fyToken balance when trading. These “virtual fyTokens”  allow us to safely reduce the amount of fyToken that must be kept in the Pools.

Since providing both underlying and fyToken is inconvenient, the Pool implements a `mintWithBase` function that allows the liquidity provider to provide only underlying, and a virtual trade will be done to convert a proportion of the underlying to fyToken inside the same pool. The amount of underlying to trade for fyToken must be calculated off-chain.

In a similar vein, a `burnForBase` function allows liquidity providers to burn their pool tokens, and trade the fyToken received for underlying without any additional asset transfers, saving gas.
#### Trading
The Pool allows the user to sell assets (underlying or fyToken). In this trade, the amount being sold is known, but not the amount being received. Within the same transaction, `sellBasePreview` or `sellFYTokenPreview` can be called to know the exact amount to be received.

The Pool also allows the user to buy assets. In this trade, the amount being received is known, but not the amount taken by the pool. Within the same transaction, `buyBasePreview` or `buyFYTokenPreview` can be called to know the exact amount to be taken by the Pool.

It is important to note that the Pool doesn’t directly take any assets from anywhere. The assets must be in the Pool before the call to a trading function for the trade to happen. In the case of calls to `buyBase` or `buyFYToken`, where the input amount is not known, the user must either call the appropriate `Preview` function in the same transaction, to transfer the exact amount to the Pool, or must transfer an amount judged sufficient for the trade to execute, and can call `retrieveBase` or `retrieveFYToken` afterwards (but in the same transaction) to recover any surplus.

#### K, G1 and G2
The K, G1 and G2 parameters determine the trading curve and the trading fees, and can be set by the Pool owner via the `setParameter` function.

#### Time-Weighted Average Rate
Much like Uniswap v2 implements a Time-Weighted Average Price, Yield v2 implements a Time-Weighted Average Rate following the same pattern. Pool balances are stored along with the time that the TWAR was last updated, and the cumulative balances ratio. With this the Pool can be used by external contracts as a Interest Rate Oracle between an underlying and a fyToken.

### PoolFactory
The Pool Factory deploys YieldSpace Pools using CREATE2.
### PoolRouter
The Pool Router batches calls to Pools, along with wrapping/unwrapping of Ether, management of off-chain approvals, and transfers of tokens from users to pools to kickstart transactions.

- Transfer to Pool: Move assets from a user to a Pool
- Route: Execute a function on a Pool
- Permit management: Execute a Dai or ERC2162 off-chain permit.
- Ether management: Convert to WETH, or from WETH.
- Batch: Group any other PoolRouter actions together in a single transaction.


