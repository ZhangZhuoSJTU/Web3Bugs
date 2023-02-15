# Trident: SushiSwap Next Generation Exchange

TRIDENT 🔱 is a newly developed AMM and routing system from [SushiSwap](https://sushi.com/) (Sushi). Trident is not a fork of any existing AMM, though to start, it incorporates popular AMM concepts into a single, upgradeable framework. The Sushi core team began development with [Andre Cronje](https://github.com/andrecronje) as [Deriswap](https://andrecronje.medium.com/deriswap-capital-efficient-swaps-futures-options-and-loans-ea424b24a41c). This development continued on as [Mirin](https://github.com/sushiswap/mirin) developed by [LevX](https://github.com/levx-io). On May 12th, 2021, Sushi began building Trident in earnest on the Mirin/Deriswap foundation.

## Deployment

### Kovan

| Contract                   | Address                                    |
| -------------------------- | ------------------------------------------ |
| BentoBox                   | 0xc381a85ed7C7448Da073b7d6C9d4cBf1Cbf576f0 |
| TridentRouter              | 0xabBf36386800A2676737Fdde61905BbF123284b3 |
| MasterDeployer             | 0xcbD2dB3c724fA4349618fb390f736185Db21a1A1 |
| ConstantProductPoolFactory | 0xD6A52478FB50f0aaB6E3Bf86f691c0D61DF18f38 |
| HybridPoolFactory          | 0x4fbeDaEcb25C8094a5bd3b75CD51F02EC956Ad31 |
| IndexPoolFactory           | 0x3fD4142E61688Db9671D6CcD937543517dAca916 |
| WETH-DAI Cpp               | 0x1Ef635cE55EaE43D62211779ac133860fcEb9886 |

## Extensibility

Trident is designed as an extensible AMM deployment framework that allows developers to implement new pool types that conform to the [IPool interface](./contracts/interfaces/IPool.sol). Before launch, an [EIP](https://eips.ethereum.org/) will be submitted for the IPool interface design to standardize pool interfaces across Ethereum. As new pool types are designed or experimented with, they can be added to Trident so long as they conform to the interface. In this way Trident will at minimum be a superset of all AMM pool designs as well as a future-proof architecture for Sushi to build on.

## Launch Pools

Initially, Trident has been developed with four primary pool types for launch:

### [ConstantProductPool](./contracts/pool/ConstantProductPool.sol)

Constant product pools are the "classic" pools that users will be most familar with. Constant product pools are a 50/50 pair pool, meaning that users first provide 50% of each of Token X and Token Y to provide liquidity. In this pool type, swaps occur over an x\*y=k constant product formula.

### [HybridPool](./contracts/pool/HybridPool.sol)

Hybrid pools allow users to use a [stableswap](https://curve.fi/files/stableswap-paper.pdf) curve with reduced price impacts. Hybrid pools are best utilized for swapping like-kind assets. Hybrid pools are configurable to allow 2, 3, or any other amount of swappable assets.

### [ConcentratedLiquidityPool](./contracts/pool/concentrated/ConcentratedLiquidityPool.sol)

Concentrated liquidity pools allow liquidity providers to specify a range in which to provide liquidity in terms of the ratio of Token X to Token Y. The benefit of this design is it will allow liquidity providers to more narrowly scope their liquidity provisioning to maximize swap fees.

### [IndexPool](./contracts/pool/IndexPool.sol)

Index pools are similar to constant product pools with the exception that they will allow different weights to be assigned to swappable assets (up to 8, currently). The advantage of this pool type is that it shifts price impacts by token weights.

All of these pools will have configurable fees that will allow liquidity providers to choose the pool that best suits their risk profile.

As a gas-saving measure, Trident further allows pool deployers to disable TWAP oracles. Architecturally, this makes the most sense for common pairs that already have accurate Chainlink price oracles.

## BentoBox Integration

Trident is a native application on the Sushi [BentoBox](https://github.com/sushiswap/bentobox) vault platform. BentoBox is part of the broader Sushi infrastructure that allows users to build complex, capital-efficient applications on top. BentoBox works by storing tokens to be utilized in strategies and flash lending. Meanwhile, a virtual "share" balance tracked by BentoBox is used by applications like Trident. The yield from BentoBox strategies and flash lending are returned to users, such as liquidity providers, enabling an optimized AMM experience. Indeed, Trident will be the most capital efficient AMM in existence at launch from this DeFi-optimized design.

For instance, if a user were to place a limit order or provide liquidity for a Trident pool, the underlying tokens would be making additional yield even if no swaps were occurring.

## Architecture

- [MasterDeployer](./contracts/deployer/MasterDeployer.sol) is used to add/remove factories for various pool types. Users call `MasterDeployer` to deploy new pools from whitelisted factories.
- `MasterDeployer` also controls the fee percentage that goes to [xSUSHI](https://etherscan.io/address/0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272#code), the `barFeeTo` address.
- `MasterDeployer` has an `owner` (ops multisig), that'll control these parameters.
- [TridentRouter](./contracts/TridentRouter.sol) is the main contract that allows interacting with various pools. It is used to initiate swaps and manage liquidity.
- `TridentRouter` is the contract that gets whitelisted in BentoBox as the master app to transfer user tokens in/out of Trident pools and BentoBox.

## Tines: Routing Engine

Tines is a new routing engine designed by Sushi for the Trident front end. Tines is an efficient multihop/multiroute swap router. Tines will query Trident pool types and consider factors such as gas costs, price impacts, and graph topology to generate a best price solution.

- Multihop - Tines can swap between multiple pools to get the best price for users.
- Multiroute - Tines can distribute a trade horizontally to minimize price impacts (slippage).

Different asset types perform better in different pool types. For instance, like-kind assets such as wBTC and renBTC tend to perform better in hybrid pools. Tines will allow routing more effectively to make multiple pools act as a unified pool resulting in drastically reduced price impacts.

## License (GPL3)

At Sushi, we believe deeply in growing the open source ecosystem of DeFi. Our Trident contract set will be [GPL3](https://www.gnu.org/licenses/gpl-3.0.en.html). As a matter of principle, Sushi will continue to release all software that we develop or own under GPL3 or other permissive OSS licenses.

## Post Launch Roadmap

- [Franchised pools](./contracts/pool/franchised)

  - Following the launch of Trident, Sushi will begin formalizing franchised pools for institutional and other permissioned use cases. Franchised pools are a way to allow users to provide liquidity on decentralized exchanges while meeting their compliance needs. As such, these pools will be differentiated from the main Trident AMM system and will allow whitelisting and similar features for liquidity providers and swappers.

- Storage Proof TWAP

  - The Trident implementation will also eventually allow for the presentation of a [storage proof](https://github.com/sushiswap/sushi-oracle) to give two simultaneous snapshots of a cumulative price. To do this, the user using the TWAP price will present a merkle proof where the block root is less than 256 blocks behind the canonical head. On chain, Trident contracts will validate such storage proof and related values to allow an instant TWAP snapshot. Sushi has repurposed another implementation for [Kashi] and is currently deployed on Polygon. Sushi is currently working on a reduced gas consumption version for deployment on Ethereum mainnet.
