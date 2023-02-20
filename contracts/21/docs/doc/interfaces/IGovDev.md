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




