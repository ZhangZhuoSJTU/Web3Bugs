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




