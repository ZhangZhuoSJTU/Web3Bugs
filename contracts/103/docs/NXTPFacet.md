# NXTP Facet

## How it works

The NXTP Facet works by forwarding NXTP (Connext) specific calls to NXTP's TransactionManager contract. This is accomplished by populating NXTP [`PrepareArgs`](https://github.com/connext/nxtp/blob/be883bd54b7e62f448452945c660e6e87055e637/packages/contracts/contracts/interfaces/ITransactionManager.sol#L72-L103) and calling the [`prepare()`](https://github.com/connext/nxtp/blob/be883bd54b7e62f448452945c660e6e87055e637/packages/contracts/contracts/TransactionManager.sol#L251-L267) method on the NXTP Transaction Manager. The NXTP [documentation](https://docs.connext.network/Integration/Guides/initiating-from-contract) details how to get the data needed for `PrepareArgs` using their SDK.

```mermaid
graph LR;
    D{LiFiDiamond}-- DELEGATECALL -->NXTPFacet;
    NXTPFacet -- CALL --> N(NXTP Transaction Manager)
```

The NXTP protocol also allows for calling contracts on the receiving chain once bridging is complete. This is accomplished by passing `calldata` in the `invariantData` property described in `_nxtpData` below. This is useful if we want to perform a swap on the recieving chain before sending to the receiver. This functionality is provided by [Gelato Network](https://gelato.network) under the hood.

```mermaid
graph LR;
    G(Gelato) -- CALL --> D{LiFiDiamond}
    D -- DELEGATECALL --> NXTPFacet;
```

## Public Methods

- `function initNXTP(ITransactionManager _txMgrAddr)`
  - Initializer method. Sets the chain specific NXTP Transaction Manager Contract
- `function startBridgeTokensViaNXTP(LiFiData memory _lifiData, ITransactionManager.PrepareArgs memory _nxtpData)`
  - Simply bridges tokens using NXTP
- `function swapAndStartBridgeTokensViaNXTP( LiFiData memory _lifiData, LibSwap.SwapData[] calldata _swapData, ITransactionManager.PrepareArgs memory _nxtpData)`
  - Performs swap(s) before bridging tokens using NXTP
- `function completeBridgeTokensViaNXTP( LiFiData memory _lifiData, address assetId, address receiver, uint256 amount)`
  - Completes a bridge transaction on the receiving chain and sends the tokens to the receiver. Should be called by the NXTP Gelato Resolver.
- `function swapAndCompleteBridgeTokensViaNXTP( LiFiData memory _lifiData, LibSwap.SwapData[] calldata _swapData, address finalAssetId, address receiver)`
  - Performs swap(s) before completing a bridge transaction on the receiving chain and sending the tokens to the receiver. Should be called by the NXTP Gelato Resolver.

## NXTP Specific Parameters

Some of the methods listed above take a variable labeled `_nxtpData`. This data is specific to NXTP and is represented as the following struct type:

```solidity
/**
 * Arguments for calling prepare()
 * @param invariantData The data for a crosschain transaction that will
 *     not change between sending and receiving chains.
 *     The hash of this data is used as the key to store
 *     the inforamtion that does change between chains
 *     (amount,expiry,preparedBlock) for verification
 * @param amount The amount of the transaction on this chain
 * @param expiry The block.timestamp when the transaction will no longer be
 *     fulfillable and is freely cancellable on this chain
 * @param encryptedCallData The calldata to be executed when the tx is
 *     fulfilled. Used in the function to allow the user
 *     to reconstruct the tx from events. Hash is stored
 *     onchain to prevent shenanigans.
 * @param encodedBid The encoded bid that was accepted by the user for this
 *     crosschain transfer. It is supplied as a param to the
 *     function but is only used in event emission
 * @param bidSignature The signature of the bidder on the encoded bid for
 *     this transaction. Only used within the function for
 *     event emission. The validity of the bid and
 *     bidSignature are enforced offchain
 * @param encodedMeta The meta for the function
 */
struct PrepareArgs {
  InvariantTransactionData invariantData;
  uint256 amount;
  uint256 expiry;
  bytes encryptedCallData;
  bytes encodedBid;
  bytes bidSignature;
  bytes encodedMeta;
}

```

## Swap Data

Some methods accept a `SwapData _swapData` parameter.

Swapping is performed by a swap specific library that expects an array of calldata to can be run on variaous DEXs (i.e. Uniswap) to make one or multiple swaps before performing another action.

The swap library can be found [here](../src/Libraries/LibSwap.sol).

## LiFi Data

Some methods accept a `LiFiData _lifiData` parameter.

This parameter is strictly for analytics purposes. It's used to emit events that we can later track and index in our subgraphs and provide data on how our contracts are being used. `LiFiData` and the events we can emit can be found [here](../src/Interfaces/ILiFi.sol).

## Getting Sample Calls to interact with the Facet

In the following some sample calls are shown that allow you to retrieve a populated transaction that can be sent to our contract via your wallet.

All examples use our [/quote endpoint](https://apidocs.li.finance/reference/get_quote-1) to retrieve a quote which contains a `transactionRequest`. This request can directly be sent to your wallet to trigger the transaction.

The quote result looks like the following:

```javascript
const quoteResult = {
    "id": "0x...",           // quote id
    "type": "lifi",          // the type of the quote (all lifi contract calls have the type "lifi")
    "tool": "hop",           // the bridge tool used for the transaction
    "action": {},            // information about what is going to happen
    "estimate": {},          // information about the estimated outcome of the call
    "includedSteps": [],     // steps that are executed by the contract as part of this transaction, e.g. a swap step and a cross step
    "transactionRequest": {  // the transaction that can be sent using a wallet
        "data": "0x...",
        "to": "0x...",
        "value": "0x00",
        "from": "{YOUR_WALLET_ADDRESS}",
        "chainId": 100,
        "gasLimit": "0x...",
        "gasPrice": "0x..."
    }
}
```

A detailed explanation on how to use the /quote endpoint and how to trigger the transaction can be found [here](https://apidocs.li.finance/reference/how-to-transfer-tokens).

**Hint**: Don't forget to replace `{YOUR_WALLET_ADDRESS}` with your real wallet address in the examples.

### Cross Only
To get a transaction for a transfer from 1 MIVA on Gnosis to MIVA on Polygon you can execute the following request:
```shell
curl 'https://li.quest/v1/quote?fromChain=DAI&fromAmount=1000000000000000000&fromToken=MIVA&toChain=POL&toToken=MIVA&slippage=0.03&allowBridges=connext&fromAddress={YOUR_WALLET_ADDRESS}'
```

### Swap & Cross
To get a transaction for a transfer from 1 DAI on Gnosis to MIVA on Polygon you can execute the following request:
```sh
curl 'https://li.quest/v1/quote?fromChain=DAI&fromAmount=1000000000000000000&fromToken=DAI&toChain=POL&toToken=MIVA&slippage=0.03&allowBridges=connext&fromAddress={YOUR_WALLET_ADDRESS}'
```

### Swap & Cross & Swap
To get a transaction for a transfer from 1 DAI on Gnosis to MATIC on Polygon you can execute the following request:
```sh
curl 'https://li.quest/v1/quote?fromChain=DAI&fromAmount=1000000000000000000&fromToken=DAI&toChain=POL&toToken=MATIC&slippage=0.03&allowBridges=connext&fromAddress={YOUR_WALLET_ADDRESS}'
```

**Hint**: Swaps on the destination chain are currently only possible with Connext.
