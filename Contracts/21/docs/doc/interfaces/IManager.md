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





