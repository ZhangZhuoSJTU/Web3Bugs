# Contract Reference

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




## IPoolStake





### `stake(uint256 _amount, address _receiver, contract IERC20 _token) → uint256`
Stake `_amount` of `_token`, send lockToken to `_receiver`


#### Parameters:
- `_amount`: Amount to stake

- `_receiver`: Account receiving the lockTokens

- `_token`: Token used

#### Return Values:
- Amount of lockTokens representing deposited `_amount`




## IGov


This contract is used for managing tokens, protocols and more in Sherlock

Contract is meant to be included as a facet in the diamond
Storage library is used

### `getGovMain() → address`
Returns the main governance address


#### Return Values:
- Main governance address

### `getWatsons() → address`
Returns the compensation address for the Watsons


#### Return Values:
- Watsons address

### `getWatsonsSherXWeight() → uint256`
Returns the weight for the Watsons compensation


#### Return Values:
- Watsons compensation weight


### `getWatsonsSherxLastAccrued() → uint256`
Returns the last block number the SherX was accrued to the Watsons


#### Return Values:
- Block number

### `getWatsonsSherXPerBlock() → uint256`
Returns the last block number the SherX was accrued to the Watsons


#### Return Values:
- Block number

### `getWatsonsUnmintedSherX() → uint256`
Returns the total amount of uminted SherX for the Watsons


#### Return Values:
- SherX to be minted


### `getUnstakeWindow() → uint256`
Returns the window of opportunity in blocks to unstake funds
Cooldown period has to be expired first to start the unstake window


#### Return Values:
- Amount of blocks

### `getCooldown() → uint256`
Returns the cooldown period in blocks
After the cooldown period funds can be unstaked


#### Return Values:
- Amount of blocks

### `getTokensStaker() → contract IERC20[]`
Returns an array of tokens accounts are allowed to stake in


#### Return Values:
- Array of ERC20 tokens

### `getTokensSherX() → contract IERC20[]`
Returns an array of tokens that are included in the SherX as underlying
Registered protocols use one or more of these tokens to compensate Sherlock


#### Return Values:
- Array of ERC20 tokens

### `getProtocolIsCovered(bytes32 _protocol) → bool`
Verify if a protocol is included in Sherlock


#### Parameters:
- `_protocol`: Protocol identifier

#### Return Values:
- Boolean indicating if protocol is included

### `getProtocolManager(bytes32 _protocol) → address`
Returns address responsible on behalf of Sherlock for the protocol


#### Parameters:
- `_protocol`: Protocol identifier

#### Return Values:
- Address of account

### `getProtocolAgent(bytes32 _protocol) → address`
Returns address responsible on behalf of the protocol


#### Parameters:
- `_protocol`: Protocol identifier

#### Return Values:
- Address of account


### `setInitialGovMain(address _govMain)`
Set initial main governance address


#### Parameters:
- `_govMain`: The address of the main governance


### `transferGovMain(address _govMain)`
Transfer the main governance


#### Parameters:
- `_govMain`: New address for the main governance

### `setWatsonsAddress(address _watsons)`
Set the compensation address for the Watsons


#### Parameters:
- `_watsons`: Address for Watsons

### `setUnstakeWindow(uint256 _unstakeWindow)`
Set unstake window


#### Parameters:
- `_unstakeWindow`: Unstake window in amount of blocks

### `setCooldown(uint256 _period)`
Set cooldown period


#### Parameters:
- `_period`: Cooldown period in amount of blocks

### `protocolAdd(bytes32 _protocol, address _eoaProtocolAgent, address _eoaManager, contract IERC20[] _tokens)`
Add a new protocol to Sherlock


#### Parameters:
- `_protocol`: Protocol identifier

- `_eoaProtocolAgent`: Account to be registered as the agent

- `_eoaManager`: Account to be registered as the manager

- `_tokens`: Initial array of tokens the protocol is allowed to pay in


### `protocolUpdate(bytes32 _protocol, address _eoaProtocolAgent, address _eoaManager)`
Update protocol agent and/or manager


#### Parameters:
- `_protocol`: Protocol identifier

- `_eoaProtocolAgent`: Account to be registered as the agent

- `_eoaManager`: Account to be registered as the manager

### `protocolDepositAdd(bytes32 _protocol, contract IERC20[] _tokens)`
Add tokens the protocol is allowed to pay in


#### Parameters:
- `_protocol`: Protocol identifier

- `_tokens`: Array of tokens to be added as valid protocol payment


### `protocolRemove(bytes32 _protocol)`
Remove protocol from the Sherlock registry


#### Parameters:
- `_protocol`: Protocol identifier

### `tokenInit(contract IERC20 _token, address _govPool, contract ILock _lock, bool _protocolPremium)`
Initialize a new token


#### Parameters:
- `_token`: Address of the token

- `_govPool`: Account responsible for the token

- `_lock`: Corresponding lock token, indicating staker token

- `_protocolPremium`: Boolean indicating if token should be registered as protocol payment


### `tokenDisableStakers(contract IERC20 _token, uint256 _index)`
Disable a token for stakers


#### Parameters:
- `_token`: Address of the token

- `_index`: Index of the token in storage array

### `tokenDisableProtocol(contract IERC20 _token, uint256 _index)`
Disable a token for protocols


#### Parameters:
- `_token`: Address of the token

- `_index`: Index of the token in storage array


### `tokenUnload(contract IERC20 _token, contract IRemove _native, address _remaining)`
Unload tokens from Sherlock


#### Parameters:
- `_token`: Address of the token

- `_native`: Contract being used to swap existing token in Sherlock

- `_remaining`: Account used to send the unallocated SherX and remaining balance for _token

### `tokenRemove(contract IERC20 _token)`
Remove a token from storage


#### Parameters:
- `_token`: Address of the token




## IGovDev


This contract is used during development for upgrading logic

Contract is meant to be included as a facet in the diamond

### `getGovDev() → address`
Returns the dev controller address


#### Return Values:
- Dev address

### `transferGovDev(address _govDev)`
Transfer dev role to other account or renounce


#### Parameters:
- `_govDev`: New dev address

### `updateSolution(struct IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata)`
Delete, update or add functions


#### Parameters:
- `_diamondCut`: Struct containing data of function mutation

- `_init`: Address to call after pushing changes

- `_calldata`: Data to call address with




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




## IManager


Managing the amounts protocol are due to Sherlock


### `setTokenPrice(contract IERC20 _token, uint256 _newUsd)`
Set internal price of `_token` to `_newUsd`


#### Parameters:
- `_token`: Token to be updated

- `_newUsd`: USD amount of token


### `setTokenPrice(contract IERC20[] _token, uint256[] _newUsd)`
Set internal price of multiple tokens


#### Parameters:
- `_token`: Array of token addresses

- `_newUsd`: Array of USD amounts


### `setProtocolPremium(bytes32 _protocol, contract IERC20 _token, uint256 _premium)`
Set `_token` premium for `_protocol` to `_premium` per block


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token address

- `_premium`: Amount of tokens to be paid per block


### `setProtocolPremium(bytes32 _protocol, contract IERC20[] _token, uint256[] _premium)`
Set multiple token premiums for `_protocol`


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Array of token addresses

- `_premium`: Array of amount of tokens to be paid per block


### `setProtocolPremium(bytes32[] _protocol, contract IERC20[][] _token, uint256[][] _premium)`
Set multiple tokens premium for multiple protocols


#### Parameters:
- `_protocol`: Array of protocol identifiers

- `_token`: 2 dimensional array of token addresses

- `_premium`: 2 dimensional array of amount of tokens to be paid per block


### `setProtocolPremiumAndTokenPrice(bytes32 _protocol, contract IERC20 _token, uint256 _premium, uint256 _newUsd)`
Set `_token` premium for `_protocol` to `_premium` per block and internal price to `_newUsd`


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Token address

- `_premium`: Amount of tokens to be paid per block

- `_newUsd`: USD amount of token


### `setProtocolPremiumAndTokenPrice(bytes32 _protocol, contract IERC20[] _token, uint256[] _premium, uint256[] _newUsd)`
Set multiple token premiums for `_protocol` and update internal prices


#### Parameters:
- `_protocol`: Protocol identifier

- `_token`: Array of token addresses

- `_premium`: Array of amount of tokens to be paid per block

- `_newUsd`: Array of USD amounts


### `setProtocolPremiumAndTokenPrice(bytes32[] _protocol, contract IERC20 _token, uint256[] _premium, uint256 _newUsd)`
Set `_token` premium for protocols and internal price to `_newUsd`


#### Parameters:
- `_protocol`: Array of protocol identifiers

- `_token`: Token address

- `_premium`: Array of amount of tokens to be paid per block

- `_newUsd`: USD amount


### `setProtocolPremiumAndTokenPrice(bytes32[] _protocol, contract IERC20[][] _token, uint256[][] _premium, uint256[][] _newUsd)`
Update multiple token premiums and prices for multiple protocols


#### Parameters:
- `_protocol`: Array of protocol identifiers

- `_token`: 2 dimensional array of tokens

- `_premium`: 2 dimensional array of amounts to be paid per block

- `_newUsd`: 2 dimensional array of USD amounts





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




## IRemove





### `swap(contract IERC20 _token, uint256 _fmo, uint256 _sherXUnderlying) → contract IERC20 newToken, uint256 newFmo, uint256 newSherxUnderlying`
Swap `_token` amounts


#### Parameters:
- `_token`: Token to swap

- `_fmo`: Amount of first money out pool swapped

- `_sherXUnderlying`: Amount of underlying being swapped

#### Return Values:
- newToken Token being swapped to

- newFmo Share of `_fmo` in newToken

- newSherxUnderlying Share of `_sherXUnderlying` in newToken




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
