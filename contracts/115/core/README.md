# Core

Note to wardens: this is our full development repository. Most of the instructions below apply for developers who are interesting in developing and running tests against the complete protocol. For the code4rena April 2022 audit please refer to the documentation in the [root](../README.md) of the repo.

## Prerequisites

- Install [`nvm`](https://github.com/nvm-sh/nvm#installing-and-updating) (Node Version Manager)
- Install the project's Node.js version 12.20.1 `nvm install v12.20.1`
- Enable the project's Node.js version with `nvm use`
- Install [Hardhat](https://hardhat.org/getting-started/) `npm install -g hardhat`
- Install [Yarn](https://yarnpkg.com/getting-started/install) `npm install -g yarn`

```bash
> hardhat version
Hardhat v2.6.4
Solidity - 0.7.0 (solc-js)
Node v12.20.1
Ethers v5.4.7
```

## Getting Started

```bash
yarn
yarn test
```

## Running scripts

### Deployment scripts

- Specific tags : `npx hardhat deploy --network <network> --tags <tags>`

## Deployment Scripts Actions

### Core

- [`CheckConfig.ts`](deploy/00_CheckConfig.ts) :
  - Checks [`deployment.ts`](config/deployment.ts) for targeted network
- [`MockTokens.ts`](deploy/00_MockTokens.ts) :
  - Only executed if test network
  - Deploys mock collateral tokens and mock MIMO token
- [`AccessController.ts`](deploy/01_AccessController.ts) : Deploys AccessController
- [`AddressProvider.ts`](deploy/02_AddressProvider.ts) : Deploys AddressProvider
- [`ConfigProvider.ts`](deploy/03_ConfigProvider.ts) : Deploys ConfigProvider
- [`PARToken.ts`](deploy/04_PARToken.js.ts) : Deploys PARToken
- [`PriceFeed.ts`](deploy/05_PriceFeed.ts) : Deploys PriceFeed
- [`RatesManager.ts`](deploy/06_RatesManager.ts) : Deploys RatesManager
- [`LiquidationManager.ts`](deploy/07_LiquidationManager.ts) : Deploys LiquidationManager
- [`FeeDistributor.ts`](deploy/08_FeeDistributor.ts) : Deploys FeeDistributor
- [`VaultsDataProvider.ts`](deploy/09_VaultsDataProvider.ts) : Deploys VaultsDataProvider
- [`VaultsCoreState.ts`](deploy/10_VaultsCoreState.ts) : Deploys VaultsCoreState
- [`VaultsCore.ts`](deploy/11_VaultsCore.ts) : Deploys VaultsCore

### SetCore

- [`setCoreProviders.ts`](deploy/12_setCoreProviders.ts) :
  - Sets AccessController on AddressProvider
  - Sets ConfigProvider on AddressProvider
  - Sets VaultsCore on AddressProvider
  - Sets PAR on AddressProvider
  - Sets RatesManager on AddressProvider
  - Sets PriceFeed on AddressProvider
  - Sets LiquidationManager on AddressProvider
  - Sets FeeDistributor on AddressProvider
  - Sets VaultsDataProvider on AddressProvider
- [`setPriceFeed.ts`](deploy/13_setPriceFeed.ts) :
  - Sets oracle for all collaterals
  - Sets EURUSD oracle
- [`setAccess.ts`](deploy/14_setAccess.ts) :
  - Grants `MINTER_ROLE` for FeeDistributor
  - Grants `MINTER_ROLE` for VaultsCore
- [`setFees.ts`](deploy/15_setFees.ts) :
  - Sets Payees to VaultsCore
  - Sets shares to 100
- [`setCollateralConfigs.ts`](deploy/16_setCollateralConfig.ts) :
  - Sets collateralConfig on ConfigProvider for all collaterals

### Governance

- [`GovernanceAddressProvider.ts`](deploy/17_GovernanceAddressProvider.ts) : Deploys GovernanceAddressProvider
- [`DebtNotifier.ts`](deploy/18_DebtNotifier.ts) : Deploys DebtNotifier
- [`SupplyMiners.ts`](deploy/19_SupplyMiners.ts) : Deploys all SupplyMiners
- [`Timelock.ts`](deploy/22_Timelock.ts) : Deploys Timelock
- [`VotingEscrow.ts`](deploy/23_VotingEscrow.ts) : Deploys VotingEscrow
- [`GovernorAlpha.ts`](deploy/28_GovernorAlpha.ts) : Deploys GovernorAlpha

### SetGovernance

- [`setGovernanceProviders.ts`](deploy/27_setGovernanceProviders.ts) :
  - Sets DebtNotifier on VaultsCore
  - Sets AddressProvider on GovernanceAddressProvider
  - Sets DebtNotifier on GovernanceAddressProvider
  - Sets GovernorAlpha on GovernanceAddressProvider
  - Sets Timelock on GovernanceAddressProvider
  - Sets votingEscrow on GovernanceAddressProvider
- [`setDebtNotifier.ts`](deploy/29_setDebtNotifier.ts) : Sets all collaterals' SupplyMiners on DebtNotifier

### GovernanceV2

- [`SupplyMinersV2.ts`](deploy/20_SupplyMinerV2.ts) : Deploys all SupplyMinersV2
- [`DemandMinersV2.ts`](deploy/21_DemandMinersV2.ts) : Deploys all DemandMinersV2
- [`VotingMinerV2.ts`](deploy/24_VotingMinerV2.ts) : Deploys VotingMinerV2
- [`DexAddressProvider.ts`](deploy/30_DexAddressProvider.ts) : Deploys DexAddressProvider
- [`PARMinerV2.ts`](deploy/32_PARMinerV2.ts) : Deploys PARMinerV2

### Inception

- [`AdminInceptionVault.ts`](deploy/35_AdminInceptionVault.ts) : Deploys AdminInceptionVault implementation contract
- [`InceptionVaultsCore.ts`](deploy/36_InceptionVaultsCore.ts) : Deploys InceptionVaultsCore implementation contract
- [`InceptionVaultsDataProvider.ts`](deploy/37_InceptionVaultsDataProvider.ts) : Deploys InceptionVaultsDataProvider implementation contract
- [`InceptionVaultFactory.ts`](deploy/38_InceptionVaultFactory.ts) : Deploys InceptionVaultFactory
- [`InceptionVaultPriceFeed.ts`](deploy/39_InceptionVaultPriceFeed.ts) : Deploys InceptionVaultPriceFeed implemtentation contracts
- [`InceptionVaultCollateral.ts`](deploy/40_InceptionCollateral.ts) :
  - Only executed if test network
  - Deploys MockAave token as inception collateral

## Oracle

- [`BalanceV2LPOracle.ts`](deploy/33_BalancerV2LPOracle.ts) : Deploys BalancerV2LPOracle
- [`GUniLPOracle.ts`](deploy/34_GUniLPOracle.ts) : Deploys GUniLPOracle

## Stand alone

- [`ChainDistributor.ts`](deploy/26_ChainDistributor.ts) : Deploys new chain ChainDistributor
- [`PARMiner.ts`](deploy/31_PARMiner.ts) : Deploys PARMiner
- [`MIMOBuyback.ts`](deploy/33_MIMOBuyback.ts) : Deploys MIMOBuyback
- [`MinerPayer.ts`](deploy/34_GUniLPOracle.ts) : Deploys MinerPayer

## Mainnet Deployment

| Contract                  | Etherscan                                                                         |
| ------------------------- | --------------------------------------------------------------------------------- |
| VaultsCore                | https://etherscan.io/address/0x4026bdcd023331d52533e3374983ded99ccbb6d4#contracts |
| AccessController          | https://etherscan.io/address/0x7df19c25971057a54405e041fd479f677038aa75#contracts |
| AddressProvider           | https://etherscan.io/address/0x6fAE125De41C03fa7d917CCfa17Ba54eF4FEb014#contracts |
| PAR                       | https://etherscan.io/address/0x68037790a0229e9ce6eaa8a99ea92964106c4703#contracts |
| RatesManager              | https://etherscan.io/address/0x8d4B22346c4c2F8aA023Af201219dD5AE93E9EcE#contracts |
| LiquidationManager        | https://etherscan.io/address/0x0a1237330268ceb2e1a8565b751c5a84d70df456#contracts |
| PriceFeed                 | https://etherscan.io/address/0xa94140087d835526d5eaedaea8573a02315d5380#contracts |
| FeeDistributor            | https://etherscan.io/address/0x585c9ad00d5dd65f3fee6aa64ffa17aec38c718a#contracts |
| MIMODistributor           | https://etherscan.io/address/0xEdfAa67889DD8D0A5A9241801B53cca3206c5030#contracts |
| ConfigProvider            | https://etherscan.io/address/0xaa4cb7dbb37dba644e0c180291574ef4e6abb187#contracts |
| VaultsDataProvider        | https://etherscan.io/address/0x9c29d8d359255e524702c7a9c95c6e6ae38274dc#contracts |
| VaultsCoreState           | https://etherscan.io/address/0x9A99a3911357F3f1934dc423956713E087eF6F25#contracts |
| DebtNotifier              | https://etherscan.io/address/0xeAaD8e52a15A78a5C8be17D3c2ac538aE04F5fEe#contracts |
| GovernanceAddressProvider | https://etherscan.io/address/0x718b7584d410f364fc16724027c07c617b87f2fc#contracts |
| PARMiner                  | https://etherscan.io/address/0x6D0a6e30eCeE498f64F77c59e3ddedC02b7d9770#contracts |
| MIMO                      | https://etherscan.io/address/0x90b831fa3bebf58e9744a14d638e25b4ee06f9bc#contracts |
| MIMOBuyback               | https://etherscan.io/address/0x3De64eed7A43C40E33dc837dec1119DcA0a677b4#contracts |

## Kovan Deployment

| Contract                  | Etherscan                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------- |
| VaultsCore                | https://kovan.etherscan.io/address/0xcc303b063088880487fc168bab3655376801c9e3#contracts |
| AccessController          | https://kovan.etherscan.io/address/0x49da15ef2de18268ca13652acc638e288afaccd9#contracts |
| AddressProvider           | https://kovan.etherscan.io/address/0xa53cddAc09fA3e97a7231E38E4A5fA5B688BcD87#contracts |
| PAR                       | https://kovan.etherscan.io/address/0x071af828464def6979fadaa34703deaacd3ac71d#contracts |
| RatesManager              | https://kovan.etherscan.io/address/0x56fa32b2e8544ce18ac07e78178a6c7daa72d4b3#contracts |
| LiquidationManager        | https://kovan.etherscan.io/address/0x2bf37def7147fa11e000195c77a587bb8b7e8e32#contracts |
| PriceFeed                 | https://kovan.etherscan.io/address/0x1ae386f42e0350058c755d7c0ce78278c987fa11#contracts |
| FeeDistributor            | https://kovan.etherscan.io/address/0x9b7a8e428fed3877c39df3932ac0809dd90296e2#contracts |
| ConfigProvider            | https://kovan.etherscan.io/address/0x0f319a9c4251eec9b4c3278354ff1d27576f4625#contracts |
| VaultsDataProvider        | https://kovan.etherscan.io/address/0x45a6dbc24f0100e680058ade73aac8496b6daecf#contracts |
| VaultsCoreState           | https://kovan.etherscan.io/address/0x233614f3ff9fcab5759dbacbb58676d31a9f4c1e#contracts |
| DebtNotifier              | https://kovan.etherscan.io/address/0xcefff225fb0453ec30f131fcc084316c03f308aa#contracts |
| GovernanceAddressProvider | https://kovan.etherscan.io/address/0x5e072BeFbDDF76F7f4553f0Ae6dE1C37532107d3#contracts |
| VotingEscrow              | https://kovan.etherscan.io/address/0xdc597097fd3f469c886d01b9272a9abf3b94a5f9#contracts |
| MIMO                      | https://kovan.etherscan.io/address/0xff148a5c19b888d557a7e208aabc0887e7486b4a#contracts |
| MimoDistributor           | https://kovan.etherscan.io/address/0x2533b74D0f59aA4Cd134e1C448A61b3e1f7b70FC#contracts |
| SupplyMiner (WETH)        | https://kovan.etherscan.io/address/0x2a0c7bfe3c9959f9c3b77c299a56a140d80cc43b#contracts |
| SupplyMiner (WBTC)        | https://kovan.etherscan.io/address/0xe9109badb17fb4098a0a4a5465160b76fc487834#contracts |
| SupplyMiner (USDC)        | https://kovan.etherscan.io/address/0x5650465013e9d059351089d114e22110edaa2d57#contracts |
| DemandMiner               | https://kovan.etherscan.io/address/0x3eC3c5Ab679114e9422aAE898c9D6De2094278E0#contracts |
| MinerPayer                | https://kovan.etherscan.io/address/0x82a87794a693681F9e1f4E1AFBBF924fD8fF36E8#contracts |

## Polygon Deployment

| Contract                  | Polygonscan                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| AccessController          | https://polygonscan.com/address/0xe95dc4d81a4707884e7db4a53954763b36cb45ae#contracts |
| AddressProvider           | https://polygonscan.com/address/0xa802ee4bd9f449295adb6d73f65118352420758a#contracts |
| ConfigProvider            | https://polygonscan.com/address/0xcae2cae9a4384b196c0f1bae59724e0eb9a347e0#contracts |
| PAR                       | https://polygonscan.com/address/0xe2aa7db6da1dae97c5f5c6914d285fbfcc32a128#contracts |
| PriceFeed                 | https://polygonscan.com/address/0x1f4d9879327e2ecc488ccc49566286c844af6f2c#contracts |
| RatesManager              | https://polygonscan.com/address/0x74419ec5ed2f745bece0d4e4118db2f33eb88367#contracts |
| LiquidationManager        | https://polygonscan.com/address/0x57896e135f845301c706f643506629493b6660ab#contracts |
| FeeDistributor            | https://polygonscan.com/address/0x313d1d48430721370ecc57262a7664e375a347fb#contracts |
| VaultsDataProvider        | https://polygonscan.com/address/0xde1996189ee1857d79f1f2bebe2a4a2b200bcb44#contracts |
| VaultsCoreState           | https://polygonscan.com/address/0x2d49e60555d0372be23e2b24aeb3e5ea55dcb417#contracts |
| VaultsCore                | https://polygonscan.com/address/0x03175c19cb1d30fa6060331a9ec181e04cac6ab0#contracts |
| GovernanceAddressProvider | https://polygonscan.com/address/0x2489DF1F40BcA6DBa1554AafeCc237BBc6d0453c#contracts |
| DebtNotifier              | https://polygonscan.com/address/0xc7d868954009df558ac5fd54032f2b6fb6ef926c#contracts |
| WMATIC supplyMiner        | https://polygonscan.com/address/0x8B264d48C0887Bc2946eA8995c3afCDBB576f799#contracts |
| WETH supplyMiner          | https://polygonscan.com/address/0x0F307e021a7E7D03b6D753B972D349F48D0B7e2B#contracts |
| WBTC supplyMiner          | https://polygonscan.com/address/0xEac544c12e8EDe461190Bb573e5d56f9198811aC#contracts |
| USDC supplyMiner          | https://polygonscan.com/address/0xdccD52EB99a7395398E4603d21f4932782f5D9EA#contracts |
| PARMiner                  | https://polygonscan.com/address/0xf6298bf14a1feeddefeb756799e89b5291bc0cdd#contracts |
| MIMO                      | https://polygonscan.com/address/0xadac33f543267c4d59a8c299cf804c303bc3e4ac#contracts |
| MIMOBuyback               | https://etherscan.io/address/0x3De64eed7A43C40E33dc837dec1119DcA0a677b4#contracts    |

## Fantom Deployment

| Contract                  | Fantomscan                                                                  |
| ------------------------- | --------------------------------------------------------------------------- |
| AccessController          | https://ftmscan.com/address/0xBDE3280EA18D34C365bdb124E56d4d6104A1ace1#code |
| AddressProvider           | https://ftmscan.com/address/0xBfb44b5839168471B14dDC770Ed2318740D93852#code |
| ConfigProvider            | https://ftmscan.com/address/0x6283BEc3cd438ffFeEc7a13E741CE201ED4eD053#code |
| PAR                       | https://ftmscan.com/address/0x13082681E8CE9bd0aF505912d306403592490Fc7#code |
| PriceFeed                 | https://ftmscan.com/address/0x1dd144c8981e16Ba4bd0c225CF82c6ac719F0c02#code |
| RatesManager              | https://ftmscan.com/address/0x35dFd72B208D08d656F1EA22792a1E5567Ee1A73#code |
| LiquidationManager        | https://ftmscan.com/address/0x8188013919BD8b801Bfda9Cbc7Ee74be883EA569#code |
| FeeDistributor            | https://ftmscan.com/address/0x493732189fDBF4982D3912460595B61c6153b038#code |
| VaultsDataProvider        | https://ftmscan.com/address/0x4F9e850b5179Ab8bBaa23DE10c54eA4A2c31f4B5#code |
| VaultsCoreState           | https://ftmscan.com/address/0xfd536362d5e0E9fbEAe6af7C3a5CdCa39C02C02d#code |
| VaultsCore                | https://ftmscan.com/address/0xB2b4feB22731Ae013344eF63B61f4A0e09fa370e#code |
| EurUsdAggregator          | https://ftmscan.com/address/0xf27c78a15F20A3B90df1aB750C19aDc8263979CA#code |
| GovernanceAddressProvider | https://ftmscan.com/address/0x70e889F9FF9e8F9D7128f29153aC0899690eBcC0#code |
| DebtNotifier              | https://ftmscan.com/address/0xF0489aE5fc699F73624D4426f4328C53Bde8C101#code |
| WFTM SupplyMiner          | https://ftmscan.com/address/0x5F640BCb86d662A817316cb9ab739f9a5A9cc804#code |
| WETH SupplyMiner          | https://ftmscan.com/address/0xFE5972B8a965415bCe47074da51d8BB487D50317#code |
| WBTC SupplyMiner          | https://ftmscan.com/address/0x7d7Bb07739bDfc71d2c942677a95406301a99c05#code |
| USDC SupplyMiner          | https://ftmscan.com/address/0x3a851B97B786a601328496C80fD67934065EAAD3#code |
| Timelock                  | https://ftmscan.com/address/0x54bef71B7428083ea2f98E4BD845F77773b41844#code |
| VotingMiner               | https://ftmscan.com/address/0x15edBEA928d4b3e65d00917e75Ed54c3C7af475d#code |
| VotingEscrow              | https://ftmscan.com/address/0xCE6B5feDd4Fd9421Aad6c8Fbd5D5808d0F5Db9C5#code |
| GovernorAlpha             | https://ftmscan.com/address/0xE554C1Ed44bD2828Dec6Ace7A949157F886d4e42#code |
| MinerPayer                | https://ftmscan.com/address/0x06380D99E5864F25914F515ad6A8a6727Be955f5#code |
| MIMOBuyback               | https://ftmscan.com/address/0xA67FC89D5312812D3413A83418fc75ff78148a7E#code |
