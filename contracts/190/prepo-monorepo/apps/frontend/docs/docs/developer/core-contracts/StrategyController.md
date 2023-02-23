## Overview

Strategy Controller acts as an intermediary between the Strategy
and the PrePO Collateral contract.

The Collateral contract should never interact with the Strategy directly
and only perform operations via the Strategy Controller.



## Functions
### deposit
```solidity
  function deposit(
    uint256 amount
  ) external
```
Deposits the specified amount of Base Token into the Strategy.

Only the vault (Collateral contract) may call this function.

Assumes approval to transfer amount from the Collateral contract
has been given.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | Amount of Base Token to deposit
### withdraw
```solidity
  function withdraw(
    address amount,
    uint256 recipient
  ) external
```
Withdraws the requested amount of Base Token from the Strategy
to the recipient.

Only the vault (Collateral contract) may call this function.

This withdrawal is optimistic, returned amount might be less than
the amount specified.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `address` | Amount of Base Token to withdraw
|recipient | `uint256` | Address to receive the Base Token
### migrate
```solidity
  function migrate(
    contract IStrategy newStrategy
  ) external
```
Migrates funds from currently configured Strategy to a new
Strategy and replaces it.

If a Strategy is not already set, it sets the Controller's
Strategy to the new value with no funds being exchanged.

Gives infinite Base Token approval to the new strategy and sets it
to zero for the old one.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newStrategy | `contract IStrategy` | Address of the new Strategy
### setVault
```solidity
  function setVault(
    address newVault
  ) external
```
Sets the vault that is allowed to deposit/withdraw through this
StrategyController.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newVault | `address` | Address of the new vault
### totalValue
```solidity
  function totalValue(
  ) external returns (uint256)
```
Returns the Base Token balance of this contract and the
`totalValue()` returned by the Strategy.



### getVault
```solidity
  function getVault(
  ) external returns (address)
```
Returns the vault that is allowed to deposit/withdraw through
this Strategy Controller.



### getBaseToken
```solidity
  function getBaseToken(
  ) external returns (contract IERC20)
```
Returns the ERC20 asset that this Strategy Controller supports
handling funds with.



### getStrategy
```solidity
  function getStrategy(
  ) external returns (contract IStrategy)
```



## Events
### VaultChanged
```solidity
  event VaultChanged(
    address vault
  )
```

Emitted via `setVault()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|vault| `address` | The new vault address
### StrategyMigrated
```solidity
  event StrategyMigrated(
    address oldStrategy,
    address newStrategy,
    uint256 amount
  )
```

Emitted via `migrate()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|oldStrategy| `address` | The old strategy address
|newStrategy| `address` | The new strategy address
|amount| `uint256` | The amount migrated
