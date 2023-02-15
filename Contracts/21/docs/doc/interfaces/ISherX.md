## ISherX


This contract is used to manage functions related to the SHERX token

Contract is meant to be included as a facet in the diamond

### `getTotalUsdPerBlock() → uint256`
Returns the USD amount of tokens being added to the SHERX pool each block


#### Return Values:
- USD amount added to SHERX pool per block

### `getTotalUsdPoolStored() → uint256`
Returns the internal USD amount of tokens represented by SHERX


#### Return Values:
- Last stored value of total internal USD underlying SHERX

### `getTotalUsdPool() → uint256`
Returns the total USD amount of tokens represented by SHERX


#### Return Values:
- Current total internal USD underlying SHERX

### `getTotalUsdLastSettled() → uint256`
Returns block number at which the total USD underlying SHERX was last stored


#### Return Values:
- Block number for stored USD underlying SHERX

### `getStoredUsd(contract IERC20 _token) → uint256`
Returns stored USD amount for `_token`


#### Parameters:
- `_token`: Token used for protocol premiums

#### Return Values:
- Stored USD amount

### `getTotalSherXUnminted() → uint256`
Returns SHERX that has not been minted yet


#### Return Values:
- Unminted amount of SHERX tokens

### `getTotalSherX() → uint256`
Returns total amount of SHERX, including unminted


#### Return Values:
- Total amount of SHERX tokens

### `getSherXPerBlock() → uint256`
Returns the amount of SHERX created per block


#### Return Values:
- SHERX per block

### `getSherXBalance() → uint256`
Returns the total amount of SHERX accrued by the sender


#### Return Values:
- Total SHERX balance

### `getSherXBalance(address _user) → uint256`
Returns the amount of SHERX accrued by `_user`


#### Parameters:
- `_user`: address to get the SHERX balance of

#### Return Values:
- Total SHERX balance

### `getInternalTotalSupply() → uint256`
Returns the total supply of SHERX from storage (only used internally)


#### Return Values:
- Total supply of SHERX

### `getInternalTotalSupplySettled() → uint256`
Returns the block number when total SHERX supply was last set in storage


#### Return Values:
- block number of last write to storage for the total SHERX supply

### `calcUnderlying() → contract IERC20[] tokens, uint256[] amounts`
Returns the tokens and amounts underlying msg.sender's SHERX balance


#### Return Values:
- tokens Array of ERC-20 tokens representing the underlying

- amounts Corresponding amounts of the underlying tokens

### `calcUnderlying(address _user) → contract IERC20[] tokens, uint256[] amounts`
Returns the tokens and amounts underlying `_user` SHERX balance


#### Parameters:
- `_user`: Account whose underlying SHERX tokens should be queried

#### Return Values:
- tokens Array of ERC-20 tokens representing the underlying

- amounts Corresponding amounts of the underlying tokens

### `calcUnderlying(uint256 _amount) → contract IERC20[] tokens, uint256[] amounts`
Returns the tokens and amounts underlying the given amount of SHERX


#### Parameters:
- `_amount`: Amount of SHERX tokens to calculate the underlying tokens of

#### Return Values:
- tokens Array of ERC-20 tokens representing the underlying

- amounts Corresponding amounts of the underlying tokens

### `calcUnderlyingInStoredUSD() → uint256`
Returns the internal USD amount underlying senders SHERX


#### Return Values:
- USD value of SHERX accrued to sender

### `calcUnderlyingInStoredUSD(uint256 _amount) → uint256 usd`
Returns the internal USD amount underlying the given amount SHERX


#### Parameters:
- `_amount`: Amount of SHERX tokens to find the underlying USD value of

#### Return Values:
- usd USD value of the given amount of SHERX

### `_beforeTokenTransfer(address from, address to, uint256 amount)`
Function called by lockTokens before transfer


#### Parameters:
- `from`: Address from which lockTokens are being transferred

- `to`: Address to which lockTokens are being transferred

- `amount`: Amount of lockTokens to be transferred

### `setInitialWeight()`
Set initial SHERX distribution to Watsons


### `setWeights(contract IERC20[] _tokens, uint256[] _weights, uint256 _watsons)`
Set SHERX distribution


#### Parameters:
- `_tokens`: Array of tokens to set the weights of

- `_weights`: Respective weighting for each token

- `_watsons`: Weighting to set for the Watsons

### `harvest()`
Harvest all tokens on behalf of the sender


### `harvest(contract ILock _token)`
Harvest `_token` on behalf of the sender


#### Parameters:
- `_token`: Token to harvest accrued SHERX for

### `harvest(contract ILock[] _tokens)`
Harvest `_tokens` on behalf of the sender


#### Parameters:
- `_tokens`: Array of tokens to harvest accrued SHERX for

### `harvestFor(address _user)`
Harvest all tokens for `_user`


#### Parameters:
- `_user`: Account for which to harvest SHERX

### `harvestFor(address _user, contract ILock _token)`
Harvest `_token` for `_user`


#### Parameters:
- `_user`: Account for which to harvest SHERX

- `_token`: Token to harvest

### `harvestFor(address _user, contract ILock[] _tokens)`
Harvest `_tokens` for `_user`


#### Parameters:
- `_user`: Account for which to harvest SHERX

- `_tokens`: Array of tokens to harvest accrued SHERX for

### `redeem(uint256 _amount, address _receiver)`
Redeems SHERX tokens for the underlying collateral


#### Parameters:
- `_amount`: Amount of SHERX tokens to redeem

- `_receiver`: Address to send redeemed tokens to

### `accrueSherX()`
Accrue SHERX based on internal weights


### `accrueSherX(contract IERC20 _token)`
Accrues SHERX to specific token


#### Parameters:
- `_token`: Token to accure SHERX to.

### `accrueSherXWatsons()`
Accrues SHERX to the Watsons.




## Events

### `Harvest(address user, contract IERC20 token)`
No description

#### Parameters:
- `user`: Address of the user for whom SHERX is harvested

- `token`: Token which had accumulated the harvested SHERX
