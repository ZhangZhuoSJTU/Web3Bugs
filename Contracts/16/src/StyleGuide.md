# Tracer Style Guide

Please follow the [official Solidity style guide](https://docs.soliditylang.org/en/latest/style-guide.html) for all Solidity smart contract contributions.

When writing natspec comments, please always maintain the format of `/** */`.

For example
```
/**
 * @notice Store the fee rate for a particular block number
 * @param feeRate A block's fee number
 * @param blockNumber Which block number to update
 */
function storeFeeRate(uint256 feeRate, uint256 blockNumber) external onlyOwner();
```