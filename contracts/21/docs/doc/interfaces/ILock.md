## ILock


Lock tokens represent a stake in Sherlock


### `getOwner() → address`
Returns the owner of this contract


#### Return Values:
- Owner address


### `underlying() → contract IERC20`
Returns token it represents


#### Return Values:
- Token address

### `mint(address _account, uint256 _amount)`
Mint `_amount` tokens for `_account`


#### Parameters:
- `_account`: Account to receive tokens

- `_amount`: Amount to be minted

### `burn(address _account, uint256 _amount)`
Burn `_amount` tokens for `_account`


#### Parameters:
- `_account`: Account to be burned

- `_amount`: Amount to be burned




