## Overview

Deploys a PrePOMarket and two LongShortToken contracts to serve as
the token pair.



## Functions
### createMarket
```solidity
  function createMarket(
    string tokenNameSuffix,
    string tokenSymbolSuffix,
    address collateral,
    address governance,
    uint256 floorLongPrice,
    uint256 ceilingLongPrice,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 mintingFee,
    uint256 redemptionFee,
    uint256 expiryTime
  ) external
```
Deploys a PrePOMarket with the given parameters and two
LongShortToken contracts to serve as the token pair.

Parameters are all passed along to their respective arguments
in the PrePOMarket constructor.

Token names are generated from `tokenNameSuffix` as the name
suffix and `tokenSymbolSuffix` as the symbol suffix.

"LONG "/"SHORT " are appended to respective names, "L_"/"S_" are
appended to respective symbols.

e.g. preSTRIPE 100-200 30-September 2021 =>
LONG preSTRIPE 100-200 30-September-2021.

e.g. preSTRIPE_100-200_30SEP21 => L_preSTRIPE_100-200_30SEP21.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|tokenNameSuffix | `string` | The name suffix for the token pair
|tokenSymbolSuffix | `string` | The symbol suffix for the token pair
|collateral | `address` | The address of the collateral token
|governance | `address` | The address of the governance contract
|floorLongPrice | `uint256` | The floor price for the Long token
|ceilingLongPrice | `uint256` | The ceiling price for the Long token
|floorValuation | `uint256` | The floor valuation for the Market
|ceilingValuation | `uint256` | The ceiling valuation for the Market
|mintingFee | `uint256` | The minting fee for Long/Short tokens
|redemptionFee | `uint256` | The redemption fee for Long/Short tokens
|expiryTime | `uint256` | The expiry time for the Market
### setCollateralValidity
```solidity
  function setCollateralValidity(
    address collateral,
    bool validity
  ) external
```
Sets whether a collateral contract is valid for assignment to
new PrePOMarkets.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|collateral | `address` | The address of the collateral contract
|validity | `bool` | Whether the collateral contract should be valid
### isCollateralValid
```solidity
  function isCollateralValid(
    address collateral
  ) external returns (bool)
```
Returns whether collateral contract is valid for assignment to
new PrePOMarkets.


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|collateral | `address` | The address of the collateral contract

### getMarket
```solidity
  function getMarket(
    bytes32 longShortHash
  ) external returns (contract IPrePOMarket)
```

`longShortHash` is a keccak256 hash of the long token address and
short token address of the PrePOMarket.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|longShortHash | `bytes32` | PrePOMarket unique identifier

## Events
### CollateralValidityChanged
```solidity
  event CollateralValidityChanged(
    address collateral,
    bool allowed
  )
```

Emitted via `setCollateralValidity()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|collateral| `address` | the collateral changed
|allowed| `bool` | whether the collateral is valid
### MarketAdded
```solidity
  event MarketAdded(
    address market,
    bytes32 longShortHash
  )
```

Emitted via `createMarket()`.

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|market| `address` | The market created
|longShortHash| `bytes32` | The market unique id
