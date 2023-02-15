# OpenLeverage contest details
- $71,250 USDT main award pot
- $3,750 USDT gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-openleverage-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 27, 2022 00:00 UTC
- Ends February 2, 2022 23:59 UTC

# Introduction of OpenLeverage
OpenLeverage is a permissionless lending margin trading protocol that enables traders or other applications to be long or short on any trading pair on DEXs efficiently and securely. 
Key features:
- Margin Trading with Liquidity on DEX, connecting traders to trade with the most liquid decentralized markets like Uniswap, Pancakeswap, and more.
- Risk Isolation Lending Pools, having two separated pools for each pair, and different risk and interest rate parameters, allow lenders to invest according to the risk-reward ratio.
- Risk Calculation with Real-time AMM Price, calculating collateral ratio with real-time AMM price for any pair available from a DEX.
- OnDemand Oracle uses TWAP prices provided by Uniswap to detect price manipulation and force price updates to make it valid for trading and liquidation.
- LToken, is an interest rate-bearing token for each lending pool, allowing third-parity to incentivize their community to provide liquidity into the lending pools into support margin trading for their token pairs.
- OLE Token, the protocol native token, mint by protocol usage, and stake to get rewards and protocol privileges.

## Demo Video
OpenLeverage Mainnet Tutorial: https://youtu.be/XTlLQu9tdt8
## Contracts Overview
The OpenLeverage Protocol comprises Smart Contracts in Solidity for permissionless lending and borrowing assets for leverage trading with DEX integration.
​
- Through provided API, anyone can create a pair of lending pools for a specific token pair.
- LToken, similar to CToken of Compound, is an interest-bearing ERC-20 token to be received by the fund supplier when they supply ERC-20 tokens to the lending pools. The LToken contracts track these balances and algorithmically set interest rates with a kinked model for borrowers.
- All margin trades will be executed against the liquidity pool of DEX, like Uniswap.
- Risk is calculated with real-time price from AMM.
- Positions are protected with OnDemand Oracle utilizing TWAP from AMM.
  
For more details visit *[OpenLeverage Documentation](https://docs.openleverage.finance).*
## Token Flows For Trading
                                                          ┌──────┐     ┌──────────────┐
                              Margin Trade                │Trader│     │ Lending Pool │
                                                          └───┬──┘     └───┬──────────┘
                                                    1.deposit │            │2.lend short token to trader
                                                      ┌───────▼────────────▼─────────┐
                ┌────────┐                            │      OPENLeverage Market     │
                │        │  5.transfer short to swap  │           │      │           │
                │External│◄───────────────────────────┤  4.collect│      │7.update   │ 3.collect fee   ┌──────┐
                │  DEX   │ 6.recevie long after swap  │  insurance│      │  trade    ├────────────────►│ XOLE │
                │        ├───────────────────────────►│           ▼      ▼           │                 └──────┘
                └────────┘                            │    Insurance     User Trade  │
                                                      └──────────────────────────────┘
    
    
    
    
    
                                                                ┌─────────┐
                              Close Trade                       │ Trader  │
                                                                └─┬─────▲─┘
                                                       1.initiate │     │7.repay user by helds
                                                      ┌───────────▼─────┴────────────┐
                 ┌────────┐                           │      OPENLeverage Market     │
                 │        │  4.transfer long to swap  │           │      │           │
                 │External│◄──────────────────────────┤  2.collect│      │8.update   │ 3.collect fee   ┌──────┐
                 │  DEX   │ 5.recevie short after swap│  insurance│      │  trade    ├────────────────►│ XOLE │
                 │        ├──────────────────────────►│           ▼      ▼           │                 └──────┘
                 └────────┘                           │    Insurance     User Trade  │
                                                      └───────────────┬──────────────┘
                                                      6.repay borrowed│
                                                               ┌──────▼───────┐
                                                               │ Lending Pool │
                                                               └──────────────┘
    
    
    
    
                                                               ┌────────────┐
                              Liquidation                      │ Liquidator │
                                                               └──┬──────▲──┘
                                                       1.initiate │      │4.collect penalty
                                                      ┌───────────▼──────┴───────────┐
                ┌────────┐                            │      OPENLeverage Market     │
                │        │  5.transfer long to swap   │           │      │           │
                │External│◄───────────────────────────┤  2.collect│      │           │ 3.collect fee   ┌──────┐
                │  DEX   │ 6.recevie short after swap │  insurance│      │           ├────────────────►│ XOLE │
                │        ├───────────────────────────►│           ▼      │10.delete  │                 └──────┘
                └────────┘                            │      Insurance   │   trade   │
                                                      │           │      │           │
                                                      │  7.spend  │      ▼           │
                                                      │  insurance│   User Trade     │
                                                      │           ▼                  │
                                                      └──────┬──────────────┬────────┘
                                             9.repay borrowed│              │8.repay trader
                                                       ┌─────▼──────┐    ┌──▼───┐
                                                       │Lending Pool│    │Trader│
                                                       └────────────┘    └──────┘
​
## Points Of Interest
- All funds are expected to be secure through the all contracts.
- Token with tax and rewards should accounted correctly and share with all holder accordingly.
- The whole margin trade process should effectively resistant to flash loan attacks by using TWAP.

# Contracts
- BscDexAggregatorV1.sol (95 lines)
- UniV2ClassDex.sol (223 lines)
  - calls external contract Dexes on BSC
- EthDexAggregatorV1.sol (152 lines)
- UniV2Dex.sol (219 lines)
  - calls external contract UniswapV2Pair
- UniV3Dex.sol (192 lines)
  - calls external contract UniswapV3Pair
- DexAggregatorDelegator.sol (23 lines)
- DexAggregatorInterface.sol (16 lines)
- FarmingPools.sol (138 lines)
- GovernorAlpha.sol (220 lines)
- OLEToken.sol (standard ERC20 with mint and burn) (65 lines)
- Timelock.sol (92 lines)
- LPool.sol (554 lines)
- LPoolDelegator.sol (42 lines)
- LPoolDepositor.sol (25 lines)
- LPoolInterface.sol (77 lines)
- Adminable.sol (33 lines)
- AirDrop.sol (85 lines)
- ControllerDelegator.sol (32 lines)
- ControllerInterface.sol (85 lines)
- ControllerV1.sol (354 lines)
- DelegateInterface.sol (4 lines)
- DelegatorInterface.sol (41 lines)
- IWETH.sol (5 lines)
- OLETokenLock.sol (67 lines)
- OpenLevDelegator.sol (31 lines)
- OpenLevInterface.sol (116 lines)
- OpenLevV1.sol (404 lines)
- OpenLevV1Lib.sol (261 lines)
- Reserve.sol (24 lines)
- Types.sol (97 lines)
- XOLE.sol (354 lines)
- XOLEDelegator.sol (30 lines)
- XOLEInterface.sol (95 lines)

To view history of the codes visit *https://github.com/OpenLeverageDev/openleverage-contracts/tree/code4rena-contest-submit*

## Links
[Telegram](https://t.me/openleverage)  
[Discord](http://discord.gg/openleverage)  
[Twitter](https://twitter.com/OpenLeverage)  
[Medium](https://medium.com/@OpenLeverage)  
[Github](https://github.com/OpenLeverageDev/openleverage-contracts)
