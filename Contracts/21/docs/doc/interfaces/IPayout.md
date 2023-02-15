## IPayout


This contract is used for doing payouts

Contract is meant to be included as a facet in the diamond
Storage library is used

### `getGovPayout() → address`
Returns the governance address able to do payouts


#### Return Values:
- Payout governance address

### `setInitialGovPayout(address _govPayout)`
Set initial payout governance address


#### Parameters:
- `_govPayout`: The address of the payout governance


### `transferGovPayout(address _govPayout)`
Transfer the payout governance


#### Parameters:
- `_govPayout`: New address for the payout governance

### `payout(address _payout, contract IERC20[] _tokens, uint256[] _firstMoneyOut, uint256[] _amounts, uint256[] _unallocatedSherX, address _exclude)`
Send `_tokens` to `_payout`


#### Parameters:
- `_payout`: Account to receive payout

- `_tokens`: Tokens to be paid out

- `_firstMoneyOut`: Amount used from first money out

- `_amounts`: Amount used staker balance

- `_unallocatedSherX`: Amount of unallocated SHERX used

- `_exclude`: Token excluded from payout




