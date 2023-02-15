# Notional Contracts V2

Notional is a fixed rate lending and borrowing platform, built on Ethereum. **Fixed rates** differ from variable rates or stable rates because the interest rate **will not** change by for the term of the loan. Fixed rate loans are 25x variable rate loans in traditional financial markets because of the superior guarantees they offer. [Notional V1](https://github.com/notional-finance/contracts) first introduced our concepts of how to achieve fixed rates on Ethereum and Notional V2 extends upon those concepts to add support for fixed term loans out to 20 years. Notional V2 also introduces many improvements upon Notional V1, including superior capital efficiency, better upgradeability, and on chain governance.

---

# Contest scope information

All code in `contracts/` is in scope, excluding:

- `contracts/mocks`
- `contracts/proxy` (this is just a port from OpenZeppelin for Solidity 0.7)
    
A full protocol description can be found in [the whitepaper](WHITEPAPER.md). Detailed code walkthroughs can be found at:

- Videos: https://www.youtube.com/watch?v=-8a5kY0QeYY&list=PLnKdM8f8QEJ2lJ59ZjhVCcJvrT056X0Ga
- Blogs: https://blog.notional.finance/tag/deep-dive/ 

Our primary concern is both the technical and economic security of user funds. We expect that the contracts accurately track user funds and there are no arbitrage conditions present. Notional V2 allows users to gain leverage and collateralize their positions in many ways (a single currency can be used as collateral in four ways: cToken 'asset cash' balances, nToken balances, fCash and liquidity tokens). As a result, free collateral and liquidation is an area of special concern. We must ensure that users can be liquidated in all scenarios where they become undercollateralized.

Notional V2 also makes special use of storage slots, these are accessed directly using assembly and packed manually in the code rather than relying on Solidity's storage packing. This is a suboptimal, however, it does allow for internal libraries to easily access storage locations without requiring the storage slot be passed in from an external contract. It has been suggested by an auditor that we put all the storage slots into a struct and pass them around the contracts but we have not refactored at this point. Obviously care must be taken with this manual approach.

Notional V2 also uses a few different internal decimal precision values. All internal accounting for balances is stored in 8 decimal places regardless of the token's native decimal precision. Interest rates and exchange rates are calculated in 9 decimal precision. Finally, percentages are stored and computed in 2 decimal precision.

## Notional V2 contest details

- $150,000 USDC + $50,000 NOTE main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-08-notional-contest/submit)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts August 26, 2021 00:00 UTC
- Ends September 8, 2021 23:59 UTC

---

## Codebase

The codebase is broken down into the following modules, each directory has a `_README.md` file that describes the module. A full protocol description can be found in WHITEPAPER.md.

```
contracts
|
└── external: all externally deployable contracts
|   └── actions: implementations of externally callable methods
|   └── adapters: adapter contracts used to interface between systems
|   └── governance: on chain governance system, forked from Compound Governor Alpha and COMP token (thanks!)
|
|       FreeCollateralExternal.sol: deployed library for checking account free collateral positions
|       Router.sol: implementation for proxy contract that delegates calls to appropriate action contract
|       SettleAssetsExternal.sol: deployed library for settling matured assets to cash
|       Views.sol: view only methods for inspecting system state
|
└── global: storage, struct and constant definitions
└── internal: shared internal libraries for handling generic system wide functionality
|   └── balances: encapsulates all internal balance and token transfer logic
|   └── liquidation: contains calculations for determining liquidation amounts
|   └── markets: contains logic for defining tradable assets and fCash liquidity curve
|   └── portfolio: handlers for account portfolios and transferring assets between them
|   └── settlement: contains logic for settling matured assets in portfolios
|   └── valuation: calculations for determining account free collateral positions
|
|       AccountContextHandler.sol: manages per account metadata
|       nTokenHandler.sol: manages nToken configuration and metadata
|
└── math: math libraries
└── mocks: mock contracts for testing internal libraries
```

# Statistics

## Code Size

| Module      | File                           | Code | Comments | Total Lines | Complexity / Line |
| :---------- | :----------------------------- | ---: | -------: | ----------: | ----------------: |
| Actions     | AccountAction.sol              |   92 |       54 |         170 |              10.9 |
| Actions     | BatchAction.sol                |  322 |       37 |         404 |              16.8 |
| Actions     | ERC1155Action.sol              |  250 |       86 |         381 |              18.0 |
| Actions     | GovernanceAction.sol           |  243 |      116 |         399 |              11.5 |
| Actions     | InitializeMarketsAction.sol    |  488 |      159 |         725 |              10.2 |
| Actions     | LiquidateCurrencyAction.sol    |  316 |       52 |         399 |               0.9 |
| Actions     | LiquidatefCashAction.sol       |  178 |       42 |         243 |               1.7 |
| Actions     | TradingAction.sol              |  470 |       42 |         571 |              11.3 |
| Actions     | nTokenAction.sol               |  194 |       57 |         290 |               9.3 |
| Actions     | nTokenMintAction.sol           |  215 |       53 |         303 |              14.9 |
| Actions     | nTokenRedeemAction.sol         |  212 |       57 |         308 |              14.6 |
| Adapters    | CompoundToNotionalV2.sol       |   66 |       19 |          99 |              10.6 |
| Adapters    | NotionalV1ToNotionalV2.sol     |  149 |       27 |         203 |               3.4 |
| Adapters    | NotionalV2FlashLiquidator.sol  |  369 |       46 |         473 |              18.4 |
| Adapters    | NotionalV2ifCashLiquidator.sol |  169 |       19 |         213 |               7.7 |
| Adapters    | cTokenAggregator.sol           |   35 |       12 |          59 |               2.9 |
| Adapters    | nTokenERC20Proxy.sol           |   74 |       43 |         136 |               0.0 |
| Balances    | BalanceHandler.sol             |  339 |       73 |         470 |              17.4 |
| Balances    | Incentives.sol                 |   67 |       16 |          98 |              10.4 |
| Balances    | TokenHandler.sol               |  199 |       25 |         260 |              21.6 |
| External    | FreeCollateralExternal.sol     |   50 |       17 |          77 |               6.0 |
| External    | PausedRouter.sol               |   36 |       18 |          65 |              22.2 |
| External    | Router.sol                     |  183 |       34 |         239 |              35.0 |
| External    | SettleAssetsExternal.sol       |  104 |        7 |         127 |               6.7 |
| External    | Views.sol                      |  448 |       54 |         564 |               5.8 |
| Global      | Constants.sol                  |   67 |       32 |         116 |               0.0 |
| Global      | StorageLayoutV1.sol            |   19 |       23 |          49 |               0.0 |
| Global      | Types.sol                      |  181 |      139 |         347 |               0.0 |
| Governance  | GovernorAlpha.sol              |  344 |      129 |         546 |              13.1 |
| Governance  | NoteERC20.sol                  |  295 |       94 |         456 |              14.2 |
| Governance  | Reservoir.sol                  |   35 |       25 |          73 |               5.7 |
| Internal    | AccountContextHandler.sol      |  174 |       47 |         262 |              30.5 |
| Internal    | nTokenHandler.sol              |  396 |       73 |         535 |               8.1 |
| Liquidation | LiquidateCurrency.sol          |  388 |       91 |         539 |              12.9 |
| Liquidation | LiquidatefCash.sol             |  357 |       88 |         506 |              11.2 |
| Liquidation | LiquidationHelpers.sol         |  176 |       33 |         236 |              13.6 |
| Markets     | AssetRate.sol                  |  189 |       36 |         263 |              11.6 |
| Markets     | CashGroup.sol                  |  298 |       46 |         387 |               6.0 |
| Markets     | DateTime.sol                   |  139 |       20 |         190 |              28.8 |
| Markets     | Market.sol                     |  553 |      180 |         835 |              10.1 |
| Math        | ABDKMath64x64.sol              |  173 |       52 |         250 |              46.2 |
| Math        | Bitmap.sol                     |   68 |       10 |          87 |              22.1 |
| Math        | FloatingPoint56.sol            |   14 |       14 |          34 |               7.1 |
| Math        | SafeInt256.sol                 |   44 |       18 |          87 |              31.8 |
| Portfolio   | BitmapAssetsHandler.sol        |  250 |       19 |         310 |              11.6 |
| Portfolio   | PortfolioHandler.sol           |  303 |       46 |         400 |              20.1 |
| Portfolio   | TransferAssets.sol             |   85 |        9 |         106 |              11.8 |
| Settlement  | SettleBitmapAssets.sol         |   64 |       28 |         106 |              15.6 |
| Settlement  | SettlePortfolioAssets.sol      |  135 |       20 |         181 |              23.7 |
| Valuation   | AssetHandler.sol               |  203 |       33 |         275 |              16.7 |
| Valuation   | ExchangeRate.sol               |   70 |       23 |         108 |              14.3 |
| Valuation   | FreeCollateral.sol             |  391 |       45 |         495 |              15.9 |

These are ported from OpenZeppelin Contracts and do not require audit:

| Module  | File                | Code | Comments | Total Lines | Complexity / Line |
| :------ | :------------------ | ---: | -------: | ----------: | ----------------: |
| Proxy   | Proxy.sol           |   29 |       46 |          85 |               3.4 |
| Proxy   | nProxy.sol          |   12 |        1 |          18 |               0.0 |
| Utils   | StorageSlot.sol     |   35 |       39 |          83 |               0.0 |
| Utils   | UUPSUpgradeable.sol |   13 |       38 |          56 |               0.0 |
| Erc1967 | ERC1967Proxy.sol    |   12 |       16 |          32 |               8.3 |
| Erc1967 | ERC1967Upgrade.sol  |   51 |       43 |         107 |              11.8 |

## Test Coverage

- Running tests using Ganache can run out of memory, use `export NODE_OPTIONS=--max-old-space-size=16000`
- `debug_traceTransaction` can also fail due to string length errors. You will see an error from brownie saying that the environment has crashed. This error is unavoidable, the plan is to test if Hardhat also has this issue.
- Coverage reports are incomplete due to the above string length issue in Ganache.

## Gas Costs

Gas costs for various scenarios are in `gas_stats.json`. This report can be regenerated by running `brownie run scripts/gas_stats.py`
