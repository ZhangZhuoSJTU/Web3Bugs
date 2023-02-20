# Tracer contest details
- $80,000 USDC main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-06-tracer-contest/submit)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts June 24 00:00 UTC
- Ends June 30 23:59 UTC

This repo will be made public before the start of the contest. (C4 delete this line when made public)

# Tracer Contest Scope
## Contracts in Scope
### Core Contracts
- `Insurance.sol`
  - 232 LOC
  - External contracts: `TracerPerpetualSwaps.sol`
  - Libraries: `LibMath.sol`, `LibInsurance.sol`, `LibBalances.sol`
- `InsurancePoolToken.sol`
  - 19 LOC
  - External contracts: None
  - Libraries: None
- `Liquidation.sol`
  - 473 LOC
  - External contracts: `Pricing.sol`, `TracerPerpetualSwaps.sol`, `Insurance.sol`, `GasOracle.sol`
  - Libraries: `LibMath.sol`, `LibLiquidation.sol`, `LibBalances.sol`, `LibPerpetuals.sol`
- `Pricing.sol`
  - 273 LOC
  - External contracts: `TracerPerpetualSwaps.sol`, `Insurance.sol`, `Oracle.sol`
  - Libraries: `LibMath.sol`, `LibPrices.sol`
- `TracerPerpetualsFactory.sol`
  - 473 LOC
  - External contracts: `PerpsDeployerV1.sol` (not in scope), `LiquidationDeployerV1.sol` (not in scope), `PricingDeployerV1.sol` (not in scope),  `InsuranceDeployerV1.sol` (not in scope)
  - Libraries:
- `TracerPerpetualSwaps.sol`
  - 599 LOC
  - External contracts: `Pricing.sol`, `Insurance.sol`, `Liquidation.sol`, `GasOracle.sol`
  - Libraries: `LibMath.sol`, `LibPrices.sol`, `LibBalances.sol`, `LibPerpetuals.sol`, `LibSafetyWithdraw.sol`
- `Trader.sol`
  - 250 LOC
  - External contracts: `TracerPerpetualSwaps.sol`
  - Libraries: `LibBalances.sol`, `LibPerpetuals.sol`
- `ChainlinkOracleAdapter.sol`
  - 66 LOC
  - External contracts: `IChainlinkOracle.sol` (out of scope)
  - Libraries: `LibMath.sol`
- `GasOracle.sol`
  - 68 LOC
  - External contracts: `IChainlinkOracle.sol` (out of scope)
  - Libraries: `LibMath.sol`
### Library Contracts
- `LibBalances`
- `LibInsurance`
- `LibLiquidation`
- `LibMaths.sol`
- `LibPerpetuals.sol`
- `LibPrices.sol`
- `SafetyWithdraw.sol`
## Novel Maths
While there is no novel maths present, an understanding of the Tracer perpetual swaps maths and mechanisms will be helpful. You can learn more from our [perpetual swaps whitepaper](https://tracer.finance/media/whitepapers/perp-swaps/Tracer_Perpetual_Swaps.pdf).

## Tokens
All tokens used within the Tracer perpetual swaps system are assumed to conform to the ERC20 standard.

## Security Assumptions
Our security assumptions for the Tracer perpetual swaps contracts are that each market is manipulatable by the owner / deployer of the market, but there should be no cross market manipulation or exploits of any kind. There is no oracle or token whitelisting to ensure that anyone can deploy any market that they want, without restrictions of the protocol getting in their way. This comes with the tradeoff that the deployer of a market can deploy using an oracle they control, and manipulate the price to have the market behave in any way they wish.

We have however provided adapters for Chainlink oracles, and will have DAO deployed markets (owned and managed by the Tracer DAO) that will use both reliable Chainlink oracles and safe underlying ERC20s.

As such, exploits that are executable by the owner of a market (such as changing the oracle at any point in time, using an ERC20 with a dangerous implementation of `transfer`, etc) are out of scope for this audit.