# ElasticSwap contest details
- $42,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-elasticswap-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 20, 2022 00:00 UTC
- Ends January 26, 2022 23:59 UTC

# Overview
ElasticSwap is the first Automated Market Maker (AMM) built explicitly to support elastic supply tokens. Our goal is to provide
a familiar AMM experience to users that supports the many newly released rebasing tokens.  Previous AMMs, like Uniswap have
not provided workable solutions to rebasing token or have even advised protocols from creating them. 

For example the Uniswap [V2 Docs](https://docs.uniswap.org/protocol/V2/reference/smart-contracts/common-errors#rebasing-tokens) have this warning:

>While positive rebalancing does not break any functionality of Uniswap, those interested in them should be aware that the positive balance found in any pair will be freely available for taking.

While supplying liquidity in a Uniswap V2 pool, liquidity providers are losing out on any rebasing that occurs and leaving it up for grabs for anyone.

We have solved this problem, allowing liquidity providers to receive their expected rebases while still providing liquidity in our pools. 

# Contracts

| Contract | SLOC | External Contracts Called | Libraries Used|
|----------|------|---------------------------|---------------|
| Exchange.sol | 326 | ERC20.sol | MathLib.sol, OpenZeppelin |
| ExchangeFactory.sol | 85 | NA | OpenZeppelin |
| MathLib.sol | 709 | NA | NA |

#### Important Notes:

 - **All source code in src/contracts/mocks is explicitly out of scope and is used for testing only**

 - **Fee on Transfer Tokens are NOT supported in our current implementation**

## Protocol Vocabulary

**Exchange** - a single instance of our amm that represents a `Base Token` and `Quote Token` Pair.

**Base Token** - an arbitrary ERC20 token that may be a token with elastic supply / rebases. (think sOHM, sKLIMA, etc)

**Quote Token** - an arbitrary ERC20 token that should be a token that does not rebase / has fixed supply.

**Decay** - the result of the imbalance in tokens that occurs immediately after a rebase occurs in the `Base Token`. See our math document below for more information on this important concept. 


# ElasticSwap Math

Our novel AMM approach is made possible by a mathematical model that ensures equality among all liquidity providers in the light of
tokens that do not have a fixed supply. The math that allows for this functionality is outlined in this [document](https://github.com/ElasticSwap/elasticswap/blob/develop/ElasticSwapMath.md). Please review the examples in this document to understand the math around how our unique AMM works.

# Running Tests
We have developed this protocol using HardHat and there is extensive test coverage that should
help Wardens understand functionality and also probe at potential issues.

To run tests please see instructions in the README.md inside of ./elasticswap


# Areas of concern
1. Price manipulation - Like most AMMs we utilize the constant product formula of `x*y=k`. Any ability to execute a swap that doesn't occur along this curve would be obviously problematic and something we would ask Wardens to spend extra time considering
1. Fair distribution of LP tokens - Our AMMs allows for single sided liquidity to be added in the presence of decay.  When this occurs, LPers are provided LP tokens that represent their share of the pool.  If they were to immediately exit after providing single sided liquidity, they would still be issued both tokens upon exit. We have worked through several scenarios there with the math and believe it always comes out to a "fair" outcome for all liquidity providers.  This would be a great area to double check our thinking on and ensure that this cannot be manipulated or gamed. Also worth considering is when LPers are exiting from their positions when decay is present in the system as well. 
