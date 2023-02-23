## Overview

LongShortToken contract representing PrePOMarket positions.

The token can represent either a Long or Short position for the
PrePOMarket it belongs to.



## Functions
### owner
```solidity
  function owner(
  ) external returns (address)
```

Inherited from OpenZeppelin Ownable.


### mint
```solidity
  function mint(
    address recipient,
    uint256 amount
  ) external
```
Mints `amount` tokens to `recipient`. Allows PrePOMarket to mint
positions for users.

Only callable by `owner()` (should be PrePOMarket).

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|recipient | `address` | Address of the recipient
|amount | `uint256` | Amount of tokens to mint
### burnFrom
```solidity
  function burnFrom(
    address account,
    uint256 amount
  ) external
```
Destroys `amount` tokens from `account`, deducting from the
caller's allowance.

Inherited from OpenZeppelin ERC20Burnable.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|account | `address` | Address of the account to destroy tokens from
|amount | `uint256` | Amount of tokens to destroy
