## ZeroExOperator

This is the main Operator. Interacting with [0x](https://0x.org/) (AMM aggregator).

0x creates off-chain orders, and settles on chain. This way, the ZeroExOperator expects to receive calldata to forwarded to 0x contracts :
```javascript
/// @param swapSelector The selector of the ZeroEx function
/// @param swapCallData 0x calldata from the API
```

The route used to get such information follows this pattern: `https://api.0x.org/swap/v1/quote?buyToken=SNX&sellToken=LINK&buyAmount=7160000000000000000000`
