## Overview

Used for minting and redeeming prePO Collateral tokens. A
Collateral token is a share of a yield-bearing vault, its Base Token value
varying based on the current value of the vault's assets.



## Functions
### deposit
```solidity
  function deposit(
    uint256 amount
  ) external returns (uint256)
```
Mints Collateral tokens for `amount` Base Token.

Assumes approval has been given by the user for the
Collateral contract to spend their funds.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | The amount of Base Token to deposit

### initiateWithdrawal
```solidity
  function initiateWithdrawal(
    uint256 amount
  ) external
```
Creates a request to allow a withdrawal for `amount` Collateral
in a later block.

The user's balance must be >= the amount requested to
initiate a withdrawal. If this function is called when there is already
an existing withdrawal request, the existing request is overwritten
with the new `amount` and current block number.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | The amount of Collateral to withdraw
### uninitiateWithdrawal
```solidity
  function uninitiateWithdrawal(
  ) external
```
Resets the existing withdrawal request on record for the caller.

This call will not revert if a user doesn't have an existing
request and will simply reset the user's already empty request record.

### withdraw
```solidity
  function withdraw(
    uint256 amount
  ) external returns (uint256)
```
Burns `amount` Collateral tokens in exchange for Base Token.

If `delayedWithdrawalExpiry` is non-zero, a withdrawal request
must be initiated in a prior block no more than
`delayedWithdrawalExpiry` blocks before. The amount specified in the
request must match the amount being withdrawn.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | The amount of Collateral to burn

### setDepositsAllowed
```solidity
  function setDepositsAllowed(
    bool allowed
  ) external
```
Sets whether deposits to the Collateral vault are allowed.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|allowed | `bool` | Whether deposits are allowed
### setWithdrawalsAllowed
```solidity
  function setWithdrawalsAllowed(
    bool allowed
  ) external
```
Sets whether withdrawals from the Collateral vault are allowed.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|allowed | `bool` | Whether withdrawals are allowed
### setStrategyController
```solidity
  function setStrategyController(
    contract IStrategyController newController
  ) external
```
Sets the contract that controls which strategy funds are sent
to.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newController | `contract IStrategyController` | Address of a contract implementing `IStrategyController`
### setDelayedWithdrawalExpiry
```solidity
  function setDelayedWithdrawalExpiry(
    uint256 expiry
  ) external
```
Sets the number of blocks to pass before expiring a withdrawal
request.

If this is set to zero, withdrawal requests are ignored.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|expiry | `uint256` | Blocks before expiring a withdrawal request
### setMintingFee
```solidity
  function setMintingFee(
    uint256 newMintingFee
  ) external
```
Sets the fee for minting Collateral, must be a 4 decimal place
percentage value e.g. 4.9999% = 49999.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newMintingFee | `uint256` | The new fee for minting Collateral
### setRedemptionFee
```solidity
  function setRedemptionFee(
    uint256 newRedemptionFee
  ) external
```
Sets the fee for redeeming Collateral, must be a 4 decimal place
percentage value e.g. 4.9999% = 49999.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newRedemptionFee | `uint256` | The new fee for redeeming Collateral
### setDepositHook
```solidity
  function setDepositHook(
    contract IHook newDepositHook
  ) external
```
Sets the contract implementing `IHook` that will be called
during the `deposit()` function.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newDepositHook | `contract IHook` | Address of a contract implementing `IHook`
### setWithdrawHook
```solidity
  function setWithdrawHook(
    contract IHook newWithdrawHook
  ) external
```
Sets the contract implementing `IHook` that will be called
during the `withdraw()` function.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newWithdrawHook | `contract IHook` | Address of a contract implementing `IHook`
### getDepositsAllowed
```solidity
  function getDepositsAllowed(
  ) external returns (bool)
```



### getWithdrawalsAllowed
```solidity
  function getWithdrawalsAllowed(
  ) external returns (bool)
```



### getTreasury
```solidity
  function getTreasury(
  ) external returns (address)
```



### getMintingFee
```solidity
  function getMintingFee(
  ) external returns (uint256)
```

Fee has four decimals places of percentage value precision
e.g. 4.9999% = 49999.

### getRedemptionFee
```solidity
  function getRedemptionFee(
  ) external returns (uint256)
```

Fee has four decimals places of percentage value precision
e.g. 4.9999% = 49999.

### getBaseToken
```solidity
  function getBaseToken(
  ) external returns (contract IERC20Upgradeable)
```
This asset will be required for minting Collateral, and
returned when redeeming Collateral.



### getStrategyController
```solidity
  function getStrategyController(
  ) external returns (contract IStrategyController)
```
The Strategy Controller intermediates any interactions between
this vault and a yield-earning strategy.



### getDelayedWithdrawalExpiry
```solidity
  function getDelayedWithdrawalExpiry(
  ) external returns (uint256)
```



### getWithdrawalRequest
```solidity
  function getWithdrawalRequest(
  ) external returns (struct ICollateral.WithdrawalRequest)
```



### getDepositHook
```solidity
  function getDepositHook(
  ) external returns (contract IHook)
```



### getWithdrawHook
```solidity
  function getWithdrawHook(
  ) external returns (contract IHook)
```



### getAmountForShares
```solidity
  function getAmountForShares(
    uint256 shares
  ) external returns (uint256)
```
Gets the amount of Base Token received for redeeming `shares`
Collateral.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|shares | `uint256` | Amount of shares that would be redeemed

### getSharesForAmount
```solidity
  function getSharesForAmount(
    uint256 amount
  ) external returns (uint256)
```


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | Amount of Base Token that would be deposited

### totalAssets
```solidity
  function totalAssets(
  ) external returns (uint256)
```
Returns the sum of the contract's latent Base Token balance and
the estimated Base Token value of the strategy's assets.

This call relies on the `totalValue()` returned by the
Strategy Controller. The Collateral vault trusts the Strategy Controller
to relay an accurate value of the Strategy's assets.


### getFeeDenominator
```solidity
  function getFeeDenominator(
  ) external returns (uint256)
```
Returns the denominator for calculating fees from 4 decimal
place percentage values e.g. 4.9999% = 49999.



### getFeeLimit
```solidity
  function getFeeLimit(
  ) external returns (uint256)
```
Returns the fee limit of 5% represented as 4 decimal place
percentage value e.g. 4.9999% = 49999.



## Events
### DepositsAllowedChanged
```solidity
  event DepositsAllowedChanged(
    bool allowed
  )
```

Emitted via `setDepositsAllowed()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|allowed| `bool` | Whether deposits are allowed
### WithdrawalsAllowedChanged
```solidity
  event WithdrawalsAllowedChanged(
    bool allowed
  )
```

Emitted via `setWithdrawalsAllowed()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|allowed| `bool` | Whether withdrawals are allowed
### StrategyControllerChanged
```solidity
  event StrategyControllerChanged(
    address controller
  )
```

Emitted via `setStrategyController()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|controller| `address` | The address of the new Strategy Controller
### MintingFeeChanged
```solidity
  event MintingFeeChanged(
    uint256 fee
  )
```

Emitted via `setMintingFee()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|fee| `uint256` | The new fee
### RedemptionFeeChanged
```solidity
  event RedemptionFeeChanged(
    uint256 fee
  )
```

Emitted via `setRedemptionFee()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|fee| `uint256` | The new fee
### DelayedWithdrawalChanged
```solidity
  event DelayedWithdrawalChanged(
    bool enabled
  )
```

Emitted via `setDelayedWithdrawal()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|enabled| `bool` | Whether or not delayed withdrawals are enabled
### DelayedWithdrawalExpiryChanged
```solidity
  event DelayedWithdrawalExpiryChanged(
    uint256 expiry
  )
```

Emitted via `setDelayedWithdrawalExpiry()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|expiry| `uint256` | The new expiry
### DepositHookChanged
```solidity
  event DepositHookChanged(
    address hook
  )
```

Emitted via `setDepositHook()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|hook| `address` | The new deposit hook
### WithdrawHookChanged
```solidity
  event WithdrawHookChanged(
    address hook
  )
```

Emitted via `setWithdrawalHook()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|hook| `address` | The new withdraw hook
