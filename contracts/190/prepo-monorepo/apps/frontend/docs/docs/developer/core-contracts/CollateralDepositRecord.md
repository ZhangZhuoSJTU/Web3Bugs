## Overview

Enforces Collateral deposit caps.



## Functions
### recordDeposit
```solidity
  function recordDeposit(
    address sender,
    uint256 finalAmount
  ) external
```

This function will be called by a Collateral hook before the fee
is subtracted from the initial `amount` passed in.

Only callable by allowed hooks.

Reverts if the incoming deposit brings either total over their
respective caps.

`finalAmount` is added to both the global and account-specific
deposit totals.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|sender | `address` | The account making the Collateral deposit
|finalAmount | `uint256` | The amount actually deposited by the user
### recordWithdrawal
```solidity
  function recordWithdrawal(
    address sender,
    uint256 finalAmount
  ) external
```
Called by a Collateral hook before the fee is subtracted from
the amount withdrawn from the Strategy.

`finalAmount` is subtracted from both the global and
account-specific deposit totals.

Only callable by allowed hooks.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|sender | `address` | The account making the Collateral withdrawal
|finalAmount | `uint256` | The amount actually withdrawn by the user
### setGlobalDepositCap
```solidity
  function setGlobalDepositCap(
    uint256 newGlobalDepositCap
  ) external
```
Sets the global cap on assets backing Collateral in circulation.

Only callable by owner().

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newGlobalDepositCap | `uint256` | The new global deposit cap
### setAccountDepositCap
```solidity
  function setAccountDepositCap(
    uint256 newAccountDepositCap
  ) external
```
Sets the cap on net Base Token deposits per user.

Only callable by owner().

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newAccountDepositCap | `uint256` | The new account deposit cap
### setAllowedHook
```solidity
  function setAllowedHook(
    address hook,
    bool allowed
  ) external
```
Sets if a contract is allowed to record deposits
and withdrawals.

Only callable by owner().

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|hook | `address` | The contract address
|allowed | `bool` | Whether or not the contract will be allowed
### getGlobalDepositCap
```solidity
  function getGlobalDepositCap(
  ) external returns (uint256)
```
Gets the maximum Base Token amount that is allowed to be
deposited (net of withdrawals).

Deposits are not allowed if `globalDepositAmount` exceeds
the `globalDepositCap`.


### getGlobalDepositAmount
```solidity
  function getGlobalDepositAmount(
  ) external returns (uint256)
```



### getAccountDepositCap
```solidity
  function getAccountDepositCap(
  ) external returns (uint256)
```

An account will not be allowed to deposit if their net deposits
exceed `accountDepositCap`.


### getNetDeposit
```solidity
  function getNetDeposit(
    address account
  ) external returns (uint256)
```


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|account | `address` | The account to retrieve net deposits for

### isHookAllowed
```solidity
  function isHookAllowed(
    address hook
  ) external returns (bool)
```
Returns whether the contract is allowed to record deposits and
withdrawals.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|hook | `address` | The contract to retrieve allowed status for

## Events
### GlobalDepositCapChanged
```solidity
  event GlobalDepositCapChanged(
    uint256 amount
  )
```

Emitted via `setGlobalDepositCap()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|amount| `uint256` | New global deposit cap
### AccountDepositCapChanged
```solidity
  event AccountDepositCapChanged(
    uint256 amount
  )
```

Emitted via `setAccountDepositCap()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|amount| `uint256` | New account deposit cap
### AllowedHooksChanged
```solidity
  event AllowedHooksChanged(
    address hook,
    bool allowed
  )
```

Emitted via `setAllowedHook()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|hook| `address` | Hook with changed permissions
|allowed| `bool` | Whether the hook is allowed
