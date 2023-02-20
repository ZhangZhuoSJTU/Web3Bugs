## IPoolBase


This contract is for every token pool

Contract is meant to be included as a facet in the diamond
Storage library is used
Storage pointer is calculated based on last _token argument

### `getCooldownFee(contract IERC20 _token) → uint256`
Returns the fee used on `_token` cooldown activation


#### Parameters:
- `_token`: Token used

#### Return Values:
- Cooldown fee scaled by 10**18

### `getSherXWeight(contract IERC20 _token) → uint256`
Returns SherX weight for `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- SherX weight scaled by 10**18

### `getGovPool(contract IERC20 _token) → address`
Returns account responsible for `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Account address

### `isPremium(contract IERC20 _token) → bool`
Returns boolean indicating if `_token` can be used for protocol payments


#### Parameters:
- `_token`: Token used

#### Return Values:
- Premium boolean

### `isStake(contract IERC20 _token) → bool`
Returns boolean indicating if `_token` can be used for staking


#### Parameters:
- `_token`: Token used

#### Return Values:
- Staking boolean

### `getProtocolBalance(bytes32 _protocol, contract IERC20 _token) → uint256`
Returns current `_token` balance for `_protocol`


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token used

#### Return Values:
- Current balance

### `getProtocolPremium(bytes32 _protocol, contract IERC20 _token) → uint256`
Returns current `_token` premium for `_protocol`


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token used

#### Return Values:
- Current premium per block

### `getLockToken(contract IERC20 _token) → contract ILock`
Returns linked lockToken for `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Address of lockToken

### `isProtocol(bytes32 _protocol, contract IERC20 _token) → bool`
Returns if `_protocol` is whitelisted for `_token`


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token used

#### Return Values:
- Boolean indicating whitelist status

### `getProtocols(contract IERC20 _token) → bytes32[]`
Returns array of whitelisted protcols


#### Parameters:
- `_token`: Token used

#### Return Values:
- Array protocol identifiers

### `getUnstakeEntry(address _staker, uint256 _id, contract IERC20 _token) → struct PoolStorage.UnstakeEntry`
Returns `_token` untake entry for `_staker` with id `_id`


#### Parameters:
- `_staker`: Account that started unstake process

- `_id`: ID of unstaking entry

- `_token`: Token used

#### Return Values:
- Unstaking entry

### `getTotalAccruedDebt(contract IERC20 _token) → uint256`
Return total debt in  `_token` whitelisted protocols accrued


#### Parameters:
- `_token`: Token used

#### Return Values:
- Total accrued debt

### `getFirstMoneyOut(contract IERC20 _token) → uint256`
Return current size of first money out pool


#### Parameters:
- `_token`: Token used

#### Return Values:
- First money out size

### `getAccruedDebt(bytes32 _protocol, contract IERC20 _token) → uint256`
Return debt in  `_token` `_protocol` accrued


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token used

#### Return Values:
- Accrued debt

### `getTotalPremiumPerBlock(contract IERC20 _token) → uint256`
Return total premium per block that whitelisted protocols are accrueing as debt


#### Parameters:
- `_token`: Token used

#### Return Values:
- Total amount of premium

### `getPremiumLastPaid(contract IERC20 _token) → uint256`
Returns block debt was last accrued.


#### Parameters:
- `_token`: Token used

#### Return Values:
- Block number

### `getSherXUnderlying(contract IERC20 _token) → uint256`
Return total amount of `_token` used as underlying for SHERX


#### Parameters:
- `_token`: Token used

#### Return Values:
- Amount used as underlying

### `getUnstakeEntrySize(address _staker, contract IERC20 _token) → uint256`
Return total amount of `_staker` unstaking entries for `_token`


#### Parameters:
- `_staker`: Account used

- `_token`: Token used

#### Return Values:
- Amount of entries

### `getInitialUnstakeEntry(address _staker, contract IERC20 _token) → uint256`
Returns initial active unstaking enty for `_staker`


#### Parameters:
- `_staker`: Account used

- `_token`: Token used

#### Return Values:
- Initial ID of unstaking entry

### `getStakersPoolBalance(contract IERC20 _token) → uint256`
Returns amount staked in `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Amount staked

### `getStakerPoolBalance(address _staker, contract IERC20 _token) → uint256`
Returns `_staker` amount staked in `_token`


#### Parameters:
- `_staker`: Account used

- `_token`: Token used

#### Return Values:
- Amount staked

### `getTotalUnmintedSherX(contract IERC20 _token) → uint256`
Returns unminted SHERX for `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Unminted SHERX

### `getUnallocatedSherXStored(contract IERC20 _token) → uint256`
Returns stored amount of SHERX not allocated to stakers


#### Parameters:
- `_token`: Token used

#### Return Values:
- Unallocated amount of SHERX

### `getUnallocatedSherXTotal(contract IERC20 _token) → uint256`
Returns current amount of SHERX not allocated to stakers


#### Parameters:
- `_token`: Token used

#### Return Values:
- Unallocated amount of SHERX

### `getUnallocatedSherXFor(address _user, contract IERC20 _token) → uint256`
Returns current amount of SHERX not allocated to `_user`


#### Parameters:
- `_user`: Staker in token

- `_token`: Token used

#### Return Values:
- Unallocated amount of SHERX

### `getTotalSherXPerBlock(contract IERC20 _token) → uint256`
Returns SHERX distributed to `_token` stakers per block


#### Parameters:
- `_token`: Token used

#### Return Values:
- Amount of SHERX distributed

### `getSherXPerBlock(contract IERC20 _token) → uint256`
Returns SHERX distributed per block to sender for staking in `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Amount of SHERX distributed

### `getSherXPerBlock(address _user, contract IERC20 _token) → uint256`
Returns SHERX distributed per block to `_user` for staking in `_token`


#### Parameters:
- `_user`: Account used

- `_token`: Token used

#### Return Values:
- Amount of SHERX distributed

### `getSherXPerBlock(uint256 _amount, contract IERC20 _token) → uint256`
Returns SHERX distributed per block when staking `_amount` of `_token`


#### Parameters:
- `_amount`: Amount of tokens

- `_token`: Token used

#### Return Values:
- SHERX to be distrubuted if staked

### `getSherXLastAccrued(contract IERC20 _token) → uint256`
Returns block SHERX was last accrued to `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Block last accrued

### `LockToTokenXRate(contract IERC20 _token) → uint256`
Current exchange rate from lockToken to `_token`


#### Parameters:
- `_token`: Token used

#### Return Values:
- Current exchange rate

### `LockToToken(uint256 _amount, contract IERC20 _token) → uint256`
Current exchange rate from lockToken to `_token` using `_amount`


#### Parameters:
- `_amount`: Amount to be exchanged

- `_token`: Token used

#### Return Values:
- Current exchange rate

### `TokenToLockXRate(contract IERC20 _token) → uint256`
Current exchange rate from `_token` to lockToken


#### Parameters:
- `_token`: Token used

#### Return Values:
- Current exchange rate

### `TokenToLock(uint256 _amount, contract IERC20 _token) → uint256`
Current exchange rate from `_token` to lockToken using `_amount`


#### Parameters:
- `_amount`: Amount to be exchanged

- `_token`: Token used

#### Return Values:
- Current exchange rate

### `setCooldownFee(uint256 _fee, contract IERC20 _token)`
Set `_fee` used for activating cooldowns on `_token`


#### Parameters:
- `_fee`: Fee scaled by 10**18

- `_token`: Token used

### `depositProtocolBalance(bytes32 _protocol, uint256 _amount, contract IERC20 _token)`
Deposit `_amount` of `_token` on behalf of `_protocol`


#### Parameters:
- `_protocol`: Protocol identifier

- `_amount`: Amount of tokens

- `_token`: Token used

### `withdrawProtocolBalance(bytes32 _protocol, uint256 _amount, address _receiver, contract IERC20 _token)`
Withdraw `_amount` of `_token` on behalf of `_protocol` to `_receiver`


#### Parameters:
- `_protocol`: Protocol identifier

- `_amount`: Amount of tokens

- `_receiver`: Address receiving the amount

- `_token`: Token used

### `activateCooldown(uint256 _amount, contract IERC20 _token) → uint256`
Start unstaking flow for sender with `_amount` of lockTokens


#### Parameters:
- `_amount`: Amount of lockTokens

- `_token`: Token used

#### Return Values:
- ID of unstaking entry


### `cancelCooldown(uint256 _id, contract IERC20 _token)`
Cancel unstaking `_token` with entry `_id` for sender


#### Parameters:
- `_id`: ID of unstaking entry

- `_token`: Token used

### `unstakeWindowExpiry(address _account, uint256 _id, contract IERC20 _token)`
Returns lockTokens to _account if unstaking entry _id is expired


#### Parameters:
- `_account`: Account that initiated unstaking flow

- `_id`: ID of unstaking entry

- `_token`: Token used

### `unstake(uint256 _id, address _receiver, contract IERC20 _token) → uint256 amount`
Unstake _token for sender with entry _id, send to _receiver


#### Parameters:
- `_id`: ID of unstaking entry

- `_receiver`: Account receiving the tokens

- `_token`: Token used

#### Return Values:
- amount of tokens unstaked

### `payOffDebtAll(contract IERC20 _token)`
Pay off accrued debt of whitelisted protocols


#### Parameters:
- `_token`: Token used

### `cleanProtocol(bytes32 _protocol, uint256 _index, bool _forceDebt, address _receiver, contract IERC20 _token)`
Remove `_protocol` from `_token` whitelist, send remaining balance to `_receiver`


#### Parameters:
- `_protocol`: Protocol indetifier

- `_index`: Entry of protocol in storage array

- `_forceDebt`: If protocol has outstanding debt, pay off

- `_receiver`: Receiver of remaining deposited balance

- `_token`: Token used




