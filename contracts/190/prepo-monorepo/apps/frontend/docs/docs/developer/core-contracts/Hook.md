## Overview

Used for adding additional checks and/or data recording when
interacting with the Collateral vault.



## Functions
### hook
```solidity
  function hook(
    address sender,
    uint256 initialAmount,
    uint256 finalAmount
  ) external
```

This hook should only contain calls to external contracts, where
the actual implementation and state of a feature will reside.

`initialAmount` for `deposit()` and `withdraw()` is the `amount`
parameter passed in by the caller.

`finalAmount` for `deposit()` is the Base Token amount provided by
the user and any latent contract balance that is included in the
deposit.

`finalAmount` for `withdraw()` is the Base Token amount returned
by the configured Strategy.

Only callable by the vault.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|sender | `address` | The account calling the Collateral vault
|initialAmount | `uint256` | The amount passed to the Collateral vault
|finalAmount | `uint256` | The amount actually involved in the transaction
