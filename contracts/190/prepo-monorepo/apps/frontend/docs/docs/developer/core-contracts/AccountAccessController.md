## Overview

The Access Controller is used for allowing/blocking access to
contract functions.



## Functions
### setRoot
```solidity
  function setRoot(
    bytes32 newRoot
  ) external
```
Sets the merkle root used to determine which accounts
to allow.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newRoot | `bytes32` | The new merkle root
### clearAllowedAccounts
```solidity
  function clearAllowedAccounts(
  ) external
```
Clears the allowlist for all accounts.

This does not actually modify any existing allowlists, the
the function will increment an index pointing to a new mapping
that will be referenced.

Only callable by `owner()`.

### setRootAndClearAllowedAccounts
```solidity
  function setRootAndClearAllowedAccounts(
    bytes32 newRoot
  ) external
```
Sets the merkle root used to determine which accounts
to allow and resets the allowlist.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newRoot | `bytes32` | The new merkle root
### clearBlockedAccounts
```solidity
  function clearBlockedAccounts(
  ) external
```
Clears the blocklist for all accounts.

This does not actually modify any existing blocklists, the
the function will increment an index pointing to a new mapping
that will be referenced.

Only callable by `owner()`.

### allowAccounts
```solidity
  function allowAccounts(
    address[] accounts
  ) external
```
Allows one or more accounts, regardless of existing access.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|accounts | `address[]` | Accounts to allow
### blockAccounts
```solidity
  function blockAccounts(
    address[] accounts
  ) external
```
Blocks one or more accounts, regardless of existing access.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|accounts | `address[]` | Accounts to block
### allowSelf
```solidity
  function allowSelf(
    bytes32[] proof
  ) external
```
Allows the caller if the provided signature is valid.

An account cannot call this function if it is already
allowed/blocked.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|proof | `bytes32[]` | Proof of the caller's inclusion in the merkle root
### getRoot
```solidity
  function getRoot(
  ) external returns (bytes32)
```
Returns the merkle root used to determine which accounts
to allow.



### isAccountAllowed
```solidity
  function isAccountAllowed(
  ) external returns (bool)
```



### isAccountBlocked
```solidity
  function isAccountBlocked(
  ) external returns (bool)
```



## Events
### RootChanged
```solidity
  event RootChanged(
    bytes32 root
  )
```

Emitted via `setRoot()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|root| `bytes32` | The new merkle root
### AccountAllowed
```solidity
  event AccountAllowed(
    address account
  )
```

Emitted via `allowAccounts()` and `allowSelf`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|account| `address` | The account that was allowed
### AccountBlocked
```solidity
  event AccountBlocked(
    address account
  )
```

Emitted via `blockAccounts()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|account| `address` | The account that was blocked
### AllowedAccountsCleared
```solidity
  event AllowedAccountsCleared(
    uint32 index
  )
```

Emitted via `setRoot()` and `clearAllowedAccounts`,
and `setRootAndClearAllowedAccounts`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|index| `uint32` | The index for the new allowlist
### BlockedAccountsCleared
```solidity
  event BlockedAccountsCleared(
    uint32 index
  )
```

Emitted via `clearBlockedAccounts`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|index| `uint32` | The index for the new blocklist
