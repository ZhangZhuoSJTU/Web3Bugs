## Overview

Users can mint/redeem long/short positions on a specific asset in
exchange for Collateral tokens.


Position settlement prices are bound by a floor and ceiling set
during market initialization.

The value of a Long and Short token should always equal 1 Collateral.

## Functions
### mintLongShortTokens
```solidity
  function mintLongShortTokens(
    uint256 amount
  ) external returns (uint256)
```
Mints Long and Short tokens in exchange for `amount`
Collateral.

Minting is not allowed after the market has ended.

`owner()` may mint tokens before PublicMinting is enabled to
bootstrap a market with an initial supply.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|amount | `uint256` | Amount of Collateral to deposit

### redeem
```solidity
  function redeem(
    uint256 longAmount,
    uint256 shortAmount
  ) external
```
Redeem `longAmount` Long and `shortAmount` Short tokens for
Collateral.

Before the market ends, redemptions can only be done with equal
parts N Long/Short tokens for N Collateral.

After the market has ended, users can redeem any amount of
Long/Short tokens for Collateral.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|longAmount | `uint256` | Amount of Long tokens to redeem
|shortAmount | `uint256` | Amount of Short tokens to redeem
### setFinalLongPrice
```solidity
  function setFinalLongPrice(
    uint256 newFinalLongPrice
  ) external
```
Sets the price a Long token can be redeemed for after the
market has ended (in wei units of Collateral).

The contract initializes this to > MAX_PRICE and knows the market
has ended when it is set to <= MAX_PRICE.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newFinalLongPrice | `uint256` | Price to set Long token redemptions
### setTreasury
```solidity
  function setTreasury(
    address newTreasury
  ) external
```
Sets the treasury address minting/redemption fees are sent to.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newTreasury | `address` | New treasury address
### setMintingFee
```solidity
  function setMintingFee(
    uint256 newMintingFee
  ) external
```
Sets the fee for minting Long/Short tokens, must be a 4
decimal place percentage value e.g. 4.9999% = 49999.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newMintingFee | `uint256` | New minting fee
### setRedemptionFee
```solidity
  function setRedemptionFee(
    uint256 newRedemptionFee
  ) external
```
Sets the fee for redeeming Long/Short tokens, must be a 4
decimal place percentage value e.g. 4.9999% = 49999.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|newRedemptionFee | `uint256` | New redemption fee
### setPublicMinting
```solidity
  function setPublicMinting(
    bool allowed
  ) external
```
Sets whether or not everyone is allowed to mint Long/Short
tokens.

Only callable by `owner()`.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|allowed | `bool` | Whether or not to allow everyone to mint Long/Short
### getCollateral
```solidity
  function getCollateral(
  ) external returns (contract IERC20)
```



### getTreasury
```solidity
  function getTreasury(
  ) external returns (address)
```



### getLongToken
```solidity
  function getLongToken(
  ) external returns (contract ILongShortToken)
```

The PrePOMarket is the owner of this token contract.


### getShortToken
```solidity
  function getShortToken(
  ) external returns (contract ILongShortToken)
```

The PrePOMarket is the owner of this token contract.


### getFloorLongPrice
```solidity
  function getFloorLongPrice(
  ) external returns (uint256)
```
Returns the lower bound of what a Long token can be priced at
(in wei units of Collateral).

Must be less than ceilingLongPrice and MAX_PRICE.


### getCeilingLongPrice
```solidity
  function getCeilingLongPrice(
  ) external returns (uint256)
```
Returns the upper bound of what a Long token can be priced at
(in wei units of Collateral).

Must be less than MAX_PRICE.


### getFinalLongPrice
```solidity
  function getFinalLongPrice(
  ) external returns (uint256)
```
Returns the price a Long token can be redeemed for after the
market has ended (in wei units of Collateral).

The contract initializes this to > MAX_PRICE and knows the market
has ended when it is set to <= MAX_PRICE.


### getMintingFee
```solidity
  function getMintingFee(
  ) external returns (uint256)
```
Returns the fee for minting Long/Short tokens as a 4 decimal
place percentage value e.g. 4.9999% = 49999.



### getRedemptionFee
```solidity
  function getRedemptionFee(
  ) external returns (uint256)
```
Returns the fee for redeeming Long/Short tokens as a 4 decimal
place percentage value e.g. 4.9999% = 49999.



### getFloorValuation
```solidity
  function getFloorValuation(
  ) external returns (uint256)
```
Returns valuation of a market when the price of a Long
token is at the floor.



### getCeilingValuation
```solidity
  function getCeilingValuation(
  ) external returns (uint256)
```
Returns valuation of a market when the price of a Long
token is at the ceiling.



### getExpiryTime
```solidity
  function getExpiryTime(
  ) external returns (uint256)
```
Returns the timestamp of when the market will expire.



### isPublicMintingAllowed
```solidity
  function isPublicMintingAllowed(
  ) external returns (bool)
```
Returns whether Long/Short token minting is open to everyone.

If true, anyone can mint Long/Short tokens, if false, only
`owner()` may mint.


### getMaxPrice
```solidity
  function getMaxPrice(
  ) external returns (uint256)
```
Long prices cannot exceed this value, equivalent to 1 ether
unit of Collateral.



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
Fee limit of 5% represented as 4 decimal place percentage
value e.g. 4.9999% = 49999.



## Events
### MarketCreated
```solidity
  event MarketCreated(
    address longToken,
    address shortToken,
    uint256 shortToken,
    uint256 floorLongPrice,
    uint256 ceilingLongPrice,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 mintingFee,
    uint256 redemptionFee,
     expiryTime
  )
```

Emitted via `constructor()`

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|longToken| `address` | Market Long token address
|shortToken| `address` | Market Short token address
|shortToken| `uint256` | Market Short token address
|floorLongPrice| `uint256` | Long token price floor
|ceilingLongPrice| `uint256` | Long token price ceiling
|floorValuation| `uint256` | Market valuation floor
|ceilingValuation| `uint256` | Market valuation ceiling
|mintingFee| `uint256` | Market minting fee
|redemptionFee| `uint256` | Market redemption fee
|expiryTime| `` | Market expiry time
### Mint
```solidity
  event Mint(
    address minter,
    uint256 amount
  )
```

Emitted via `mintLongShortTokens()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|minter| `address` | The address of the minter
|amount| `uint256` | The amount of Long/Short tokens minted
### Redemption
```solidity
  event Redemption(
    address redeemer,
    uint256 amount
  )
```

Emitted via `redeem()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|redeemer| `address` | The address of the redeemer
|amount| `uint256` | The amount of Long/Short tokens redeemed
### FinalLongPriceSet
```solidity
  event FinalLongPriceSet(
    uint256 price
  )
```

Emitted via `setFinalLongPrice()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|price| `uint256` | The final Long price
### TreasuryChanged
```solidity
  event TreasuryChanged(
    address treasury
  )
```

Emitted via `setTreasury()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|treasury| `address` | The new treasury address
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
|fee| `uint256` | The new minting fee
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
|fee| `uint256` | The new redemption fee
### PublicMintingChanged
```solidity
  event PublicMintingChanged(
    bool allowed
  )
```

Emitted via `setPublicMinting()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|allowed| `bool` | The new public minting status
