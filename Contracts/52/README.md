# Vader contest details

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-11-vader-protocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts November 9, 2021 00:00 UTC
- Ends November 15, 2021 23:59 UTC

# Introduction

[White paper](https://github.com/vetherasset/vaderprotocol-whitepaper)

Vader is a new form of liquidity protocol that seeks to be self-serving. It uses its own liquidity and awareness of asset purchasing power to support the creation of a collateralized stablecoin. It also is capable of using liquidity units as collateral for synthetic assets, of which it will always have guaranteed redemption liquidity for. It has a fair and transparent incentive strategy to maximise the depth of liquidity pools and adoption of synthetic assets. It uses a liquidity-sensitive fee to ensure safe and sustainable creation of debt, which can increase the capital efficiency of the system.

## Key Features

The following are the key features of Vader Protocol:

1. Uses a collateralized stablecoin settlement asset
2. An ability to burn VADER to mint USDV
3. Impermanent Loss protection for Liquidity Providers in the pools
4. Continuous liquidity pool incentives
5. An ability to mint interest-bearing synthetic assets from pool liquidity
6. An ability to borrow debt against USDV, VADER or Synthetic Assets

## Contracts

```bash
├── dex
│   ├── math
│   │   └── VaderMath.sol
│   ├── pool
│   │   ├── BasePool.sol
│   │   ├── VaderPoolFactory.sol
│   │   └── VaderPool.sol
│   ├── queue
│   │   └── SwapQueue.sol
│   ├── router
│   │   └── VaderRouter.sol
│   └── utils
│       └── GasThrottle.sol
├── dex-v2
│   ├── pool
│   │   ├── BasePoolV2.sol
│   │   └── VaderPoolV2.sol
│   ├── router
│   │   └── VaderRouterV2.sol
│   ├── synths
│   │   ├── SynthFactory.sol
│   │   └── Synth.sol
│   └── wrapper
│       ├── LPToken.sol
│       └── LPWrapper.sol
├── external
│   ├── interfaces
│   │   ├── AggregatorV3Interface.sol
│   │   ├── IUniswapV2Callee.sol
│   │   ├── IUniswapV2ERC20.sol
│   │   ├── IUniswapV2Factory.sol
│   │   └── IUniswapV2Pair.sol
│   ├── libraries
│   │   ├── Babylonian.sol
│   │   ├── BitMath.sol
│   │   ├── FixedPoint.sol
│   │   ├── FullMath.sol
│   │   ├── Math.sol
│   │   ├── UniswapV2Library.sol
│   │   ├── UniswapV2OracleLibrary.sol
│   │   └── UQ112x112.sol
│   ├── UniswapV2ERC20.sol
│   └── UniswapV2Pair.sol
├── governance
│   ├── GovernorAlpha.sol
│   └── Timelock.sol
├── interfaces
│   ├── dex
│   │   ├── pool
│   │   │   ├── IBasePool.sol
│   │   │   ├── ISwapQueue.sol
│   │   │   ├── IVaderPoolFactory.sol
│   │   │   └── IVaderPool.sol
│   │   ├── queue
│   │   │   ├── IGasQueue.sol
│   │   │   └── ISwapQueue.sol
│   │   └── router
│   │       └── IVaderRouter.sol
│   ├── dex-v2
│   │   ├── pool
│   │   │   ├── IBasePoolV2.sol
│   │   │   ├── IVaderPoolFactoryV2.sol
│   │   │   └── IVaderPoolV2.sol
│   │   ├── router
│   │   │   └── IVaderRouterV2.sol
│   │   ├── synth
│   │   │   ├── ISynthFactory.sol
│   │   │   └── ISynth.sol
│   │   └── wrapper
│   │       ├── ILPToken.sol
│   │       └── ILPWrapper.sol
│   ├── external
│   │   └── chainlink
│   │       └── IAggregator.sol
│   ├── governance
│   │   └── ITimelock.sol
│   ├── reserve
│   │   └── IVaderReserve.sol
│   ├── shared
│   │   └── IERC20Extended.sol
│   ├── tokens
│   │   ├── converter
│   │   │   └── IConverter.sol
│   │   ├── IUSDV.sol
│   │   ├── IVader.sol
│   │   └── vesting
│   │       └── ILinearVesting.sol
│   └── x-vader
│       └── IXVader.sol
├── Migrations.sol
├── mocks
│   ├── MockAggregatorV3.sol
│   ├── MockConstants.sol
│   ├── MockGovernorAlpha.sol
│   ├── MockTarget.sol
│   ├── MockTimelock.sol
│   ├── MockToken.sol
│   ├── MockUniswapV2Factory.sol
│   ├── MockUniswapV2Library.sol
│   └── MockXVader.sol
├── reserve
│   └── VaderReserve.sol
├── shared
│   └── ProtocolConstants.sol
├── staking-rewards
│   ├── IStakingRewards.sol
│   ├── Owned.sol
│   ├── Pausable.sol
│   ├── RewardsDistributionRecipient.sol
│   └── StakingRewards.sol
├── tokens
│   ├── converter
│   │   └── Converter.sol
│   ├── USDV.sol
│   ├── Vader.sol
│   └── vesting
│       └── LinearVesting.sol
├── twap
│   └── TwapOracle.sol
└── x-vader
    └── XVader.sol
```

```
├── interfaces
│   ├── IERC20Metadata.sol
│   └── ITreasury.sol
├── lib
│   ├── FixedPoint.sol
│   └── FullMath.sol
├── Ownable.sol
├── test
│   └── TestToken.sol
├── Treasury.sol
└── VaderBond.sol
```

There are five different ERC20 tokens in the codebase. Two tokens Synth and LPToken under `dex-v2` directory are standard Burnable and Mintable ERC20 tokens. The LPToken represents liquidity issued in fungible tokens and its total supply is tracked by the Vader pool which represents total liquidity issued against the pair which is not necessarily equal to LPToken’s actual total supply as liquidity can be issued in non-fungible tokens as well.
The two tokens USDV and Vader under `tokens` directory are standard ERC20 tokens with Vader token having an emission curve covered over 5 years duration.
The token XVader under `x-vader` directory is a standard ERC20 token that inherits from `ERC20Votes` contract from Openzeppelin. This token is for governance purposes in Vader’s GovernorAlpha contract.

The Vader approach to implement pools of pairs is different from Uniswap’s. There is a singleton pool contract that implements the logic for pairs. All the pairs comprise of native and foreign assets. The native asset is USDV , while the foreign asset can be any ERC20 compatible token. The pool contract implements the logic for depositing and withdrawing of liquidity as well as swapping between the foreign assets among two different pairs and between native and foreign assets of a pair.
The liquidity issued against the pairs in pool can be in non-fungible token, fungible token or synthetic token.
There is a Vader Reserve contract that covers any impermanent loss experienced by liquidity providers.
The codebase implements a TWAP feature which makes use of aggregation over several Uniswap and Vader pools to determine the true USD value of Vader and USDV, respectively.
As xVADER token is mintable, the GovernorAlpha contract makes use of the snapshotted total supply of xVADER at the time of proposal creation to determine a proposal’s outcome.

VaderBond is a modification of Olympus DAO / Pro contracts

## Points of interest

Check if:

- The code under `dex-v2` directory should be reviewed for any exploits that allow draining of funds from the pool contract involving pairs.
- There is no inconsistency encountered in the liquidity issuance and redeeming as the liquidity is issued in non-fungible, fungible and synthetic tokens. They should work together seamlessly.
- The TWAP contract properly and correctly calculates the true USD values for Vader and USDV assets, and the conversion between USDV and Vader is correct.
- The Veto functionality of GovernorAlpha contract works as intended and does not introduce any vulnerability.

- How should the Treasury.sol contract calculate value of principal token, same way as Olypmus DAO or Pro?
  Olympus DAO has two methods of calculation, one for RFV tokens and one for LP tokens.
  Olympus Pro has only one method of calculation.
- VaderBond removes FixedPoint library which is used in Olympus contracts. Will this cause rounding errors?
