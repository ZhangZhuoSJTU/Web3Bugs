## ISherXERC20





### `name() → string`
Get the token name


#### Return Values:
- The token name

### `symbol() → string`
Get the token symbol


#### Return Values:
- The token symbol

### `decimals() → uint8`
Get the amount of decimals


#### Return Values:
- Amount of decimals

### `initializeSherXERC20(string _name, string _symbol)`
Sets up the metadata and initial supply. Can be called by the contract owner


#### Parameters:
- `_name`: Name of the token

- `_symbol`: Symbol of the token

### `increaseApproval(address _spender, uint256 _amount) → bool`
Increase the amount of tokens another address can spend


#### Parameters:
- `_spender`: Spender

- `_amount`: Amount to increase by

### `decreaseApproval(address _spender, uint256 _amount) → bool`
Decrease the amount of tokens another address can spend


#### Parameters:
- `_spender`: Spender

- `_amount`: Amount to decrease by




