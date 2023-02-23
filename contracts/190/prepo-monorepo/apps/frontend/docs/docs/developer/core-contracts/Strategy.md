## Overview

Strategy that deploys Base Token to earn yield denominated in Base
Token.


`owner()` can call emergency functions and setters, only controller
can call deposit/withdraw.

## Functions
### deposit
```solidity
  function deposit(
    uint256 amount
  ) external
```
Deposits `amount` Base Token into the strategy.

Assumes the StrategyController has given infinite spend approval
to the strategy.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | Amount of Base Token to deposit
### withdraw
```solidity
  function withdraw(
    address recipient,
    uint256 amount
  ) external
```
Withdraws `amount` Base Token from the strategy to `recipient`.

This withdrawal is optimistic, returned amount might be less than
the amount specified.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|recipient | `address` | Address to receive the Base Token
|amount | `uint256` | Amount of Base Token to withdraw
### totalValue
```solidity
  function totalValue(
  ) external returns (uint256)
```
Returns the Base Token balance of this contract and
the estimated value of deployed assets.



### getController
```solidity
  function getController(
  ) external returns (contract IStrategyController)
```
Returns the Strategy Controller that intermediates interactions
between a vault and this strategy.

Functions with the `onlyController` modifier can only be called by
this Strategy Controller.


### getBaseToken
```solidity
  function getBaseToken(
  ) external returns (contract IERC20)
```
The ERC20 asset that this strategy utilizes to earn yield and
return profits with.



