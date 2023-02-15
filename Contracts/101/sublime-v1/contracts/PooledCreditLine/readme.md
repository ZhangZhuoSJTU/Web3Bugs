# Pooled credit lines

## LenderPool 

The lenders interact with this contract to manage the PCl for example deposit assets they want to lend, withdraw interest or lent amount, liquidate the credit line.

[code](/contracts/PooledCreditLine/LenderPool.sol)

### LenderPoolVariables

this struct stores the current state of the credit line. each variable of the struct is discussed below

### LenderPoolVariables.sharesHeld

`sharedHeld` represent the amount of shares of the borrow asset received from the yield strategy contract. An example of shares is the [Compound CTokens](https://compound.finance/docs/ctokens).

in the `LenderPool._accept` method `sharesHeld` is **set** to the value of the tokens locked in the strategy contract for the given amount of `borrowAsset` deposited by the lenders in the PCL. For example if the borrowAsset is DAI and 100K DAI is the borrowLimit. Then 100K worth of Compound DAI `cDAI` will be set as the sharedHeld when the PCL is accepted. The exchange rate of borrow asset to shares keeps changing.

`LP._accept` -> `SA.deposit` -> `YS.lockTokens`

```solidity
pooledCLVariables[_id].sharesHeld = SAVINGS_ACCOUNT.deposit(_borrowAsset, _strategy, address(this), _amount);
```

`sharesHeld` are reduced when the borrower has borrowed some funds from the PCL by calling the `PooledCreditLine.borrow` method. The borrower has the option to borrow less than the amount asked in the PCL. The reduction of shares is done in the callback method `LenderPool.borrowed`

```solidity
pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.sub(_sharesBorrowed);
```

when the funds are repaid by the borrower by calling `PooledCreditLine.borrow`, the repaid funds are deposited back in the PCL. Before paying the principal borrowed the interest is paid back. So the amount repaid back by the borrower includes both the interest and the principal. The amount paid back is converted into yield strategy shares and added back to sharesHeld. The addition of shares held is done in the `LenderPool.repaid` method.

```solidity
pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.add(_sharesRepaid);
```

if the borrower has paid all the borrowed amount plus any accrued interest, the sharesHeld after the repayment can be greater than the value of sharesHeld before any borrowing happened because now it has interest paid back as well.

### LenderPoolVariables.borrowerInterestShares

`borrowerInterestShares` stores the amount of shares repaid by the borrower specifically as the interest accrued. As mentioned above the borrowers has to pay back the interest before it can pay back the principal.

### LenderPoolVariables.borrowerInterestSharesWithdrawn

When the lenders withdraw interest it is subtracted from the `sharesHeld`. Interest can be withdrawn from the PCL at any time by calling the method `LenderPool.withdrawInterest`. The borrower interest which is the interest accrued specifically from the principal borrowed is withdrawn form the PCL is stored in the field called `borrowerInterestSharesWithdrawn`. 

There is the yield interest also which is accrued from the investment strategy contract. yield interest withdrawn is stored in the variable `yieldInterestWithdrawnShares`. So the total interest is the yield interest + borrower interest. The borrower interest is accrued only when the PCL is active. The yield interest is accrued when there are assets deposited in the strategy contract which can be even when the PCL is not active.

Lenders cannot withdraw liquidity while the PCL is active. So liquidity can be withdrawn when the PCL is closed, liquidated, cancelled and in such cases if there is any interest accrued it is also withdrawn with the liquidity and is subtracted from the `sharesHeld`. Note that any liquidity withdrawn from the shares is not reduced from the sharesHeld. Once the `LenderPool.withdrawLiquidity` has been called sharesHeld will be equal to the shares worth the amount deposited in the PCL by the lenders. If the sharesHeld is 0 then it means the PCL was never accepted.


### LenderPoolVariables.yieldInterestWithdrawnShares

The funds sitting idle in the lender pool contract are invested in protocols like compound. This is done via the [savings account](/contracts/SavingsAccount/SavingsAccount.sol) contract which interacts with the yield strategy contracts.

The funds are deposited in the yield strategy and in return we get the shares (for example CTokens). Ideally value of these shares increases in terms of the asset deposited because of investment returns. When the shares are withdrawn from the yield strategy we deposit the shares in the yield strategy and get back the deposited asset along with the investment profit also called yield. For example if we deposit 100K DAI for 1 year in the strategy contract. After 1 year on withdrawing the funds we can get back 105K USDC.

The lenders can withdraw the yield as well as the interest accrued from the lender pool by calling the method `LenderPool.withdrawInterest`.

#### How is the yield interest calculated?  
maximum tokens which can be borrowed  
```
borrowLimit = 100_000
```
tokens not yet borrowed  
```
notBorrowed = 10_000
```
.85 exchange ratio for shares:token this is the current exchange rate  
```
notBorrowedShares = 8_500
```
shares held are the not borrowed shares plus interest paid by the lender  
notBorrowed amount was converted to strategy shares earlier so the exchange rate was different  
same goes for the interest paid by the borrower at different times  
```
sharesHeld = 9_200
_totalInterestInShares = sharesHeld.sub(notBorrowedShares)
_totalInterestInShares = 9_200 - 8_500 = 700
```
interest deposited by the borrower at different times in terms of shares  
```
_borrowerInterestShares = 500
``` 
interest shares withdrawn by lenders  
```
borrowerInterestSharesWithdrawn = 10
_borrowerInterestWithdrawableInShares = 500 - 10 = 490
```
yield interest is growth in the exchange ratio from before to the exchange rate today
```
_totalYieldInterest = _totalInterestInShares - _borrowerInterestWithdrawableInShares
_totalYieldInterest = 700 - 490 = 210
```
this is the yield interest already withdrawn by lenders which added to get the final value of yield interest
```
yieldInterestWithdrawnShares = 40
_totalYieldInterest = _totalYieldInterest + yieldInterestWithdrawnShares
```
now this value represents the total yield from the strategy protocol
```
_totalYieldInterest = 210 + 40 = 250
```

### LenderPoolVariables.collateralHeld

this is the amount of collateral in the lenderPool contract which was liquidated by calling the `LenderPool.liquidate` method. A PCl can be liquidated by calling this method if the collateral ratio falls below the ideal value or the repayment of the principal plus interest is not done beyond the grace period set in the PCL.

## Flow of funds in and out of LenderPool contract

```solidity
function lend(uint256 _id, uint256 _amount) external;
```

- borrowAsset is deposited **IN** the LenderPool contract by calling address. The caller can only be a verified lender. so the balance of the LenderPool contract is increased for the borrowAsset by `_amount`
- Lp tokens are **minted** and transferred **OUT** to the caller.


```solidity
function start(uint256 _id) external;
```

- the borrowAsset in the LenderPool is transferred **OUT** to the SavingsAccount contract using the deposit method on the savings account. so the balance of the LenderPool contract is decreased for the borrowAsset equal to the `borrowLimit`

```solidity
function terminate(uint256 _id, address _to) external
```

- the borrowAsset is transferred **OUT** from the savings account of the lender pool to the `_to` address
- the liquidated collateral asset received from the pooled credit line contract earlier is transferred **OUT** to the `_to` address. So the balance of the credit for the collateral asset is reduced.


```solidity
function withdrawInterest(uint256 _id) external;
```

here the balance of the lender pool's savings account is reduced for borrowAsset by the amount of interest to be transferred **OUT** to the `msg.sender`.


```solidity
function withdrawLiquidity(uint256 _id) external;
```

- this method behaves different depending on the condition of the pcl
- in cancelled state the borrowAsset is transferred **OUT** from the lender pool to the `msg.sender`
- in closed or liquidated stage the balance of the lender pool's savings account is reduced for the borrow asset by the amount to be transferred **OUT** to the `msg.sender`.

```solidity
function withdrawLiquidatedTokens(uint256 _id) external
```

- the liquidated collateral tokens are transferred **OUT** to the `msg.sender`. So the collateral asset balance of the lender pool is reduced for the amount determined in the method.

```solidity
lp token transfer
```

lp token transfer calls the `withdrawInterest` method.


## Flow of funds in and out of PooledCreditLine contract

```solidity
function depositCollateral(uint256 _id, uint256 _amount, bool _fromSavingsAccount) external;
```

collateralAsset is transferred from the `msg.sender` and deposited **IN** the pooled credit line's savings account 

```solidity
function withdrawCollateral(uint256 _id, uint256 _amount, bool _toSavingsAccount) external;
```

in this method the collateral asset is transferred **OUT** from the pooled credit line's savings account

```solidity
function borrow(uint256 _id, uint256 _amount) external;
```

borrowAsset is transferred **OUT** from the lender pool's savings account to the `msg.sender`.  
**NOTE**: the borrowAsset transferred out is from the lender pool's savings account and not the pooled credit line's.

```solidity
function repay(uint256 _id, uint256 _amount) external;
```

borrowAsset is transferred **IN** from the `msg.sender` to the lender pool's savings account.  
**NOTE**: the borrowAsset transferred in is to the lender pool's savings account and not the pooled credit line's.

```solidity
function liquidate(uint256 _id) external;
```

- the collateral asset in the pooled credit line's savings account is transferred **OUT** to the lender pool contract.
- this method is a callback from the lender pool contract.

```solidity
function close(uint256 _id) external;
```

this method internally calls `withdrawCollateral` which transfers **OUT** the collateral asset from the pooled credit line's savings account to the borrower.

```solidity
function terminate(uint256 _id) external;
```

the collateral asset in the pooled credit line's savings account is transferred **OUT** to the admin.