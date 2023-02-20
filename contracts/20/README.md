# Spartan Protocol contest details
- $80,000USDC main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-07-spartan-protocol-contest/submit)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts 2021-07-15 00:00 UTC
- Ends 2021-07-21 23:59 UTC

[spartanprotocol.org](https://spartanprotocol.org/) • [@SpartanProtocol](https://twitter.com/SpartanProtocol) • [telegram](https://t.me/SpartanProtocolOrg) • [discord](https://discord.gg/wQggvntnGk) • [documentation](https://docs.spartanprotocol.org/)

## Contest scoping

- Pool.sol : 365 lines : Holds Protocol Liquidity : High Importance
- Router.sol : 358 lines : Routes funds, Incentivises LP's : Medium Importance
- Dao.sol : 721 lines : Protocol Governance : High Importance
- Synth.sol : 229 lines : Holds Pool Tokens As Collateral : High Importance
- daoVault.sol : 95 lines : Holds User Funds : High Importance
- synthVault.sol : 257 lines : Holds User Funds : High Importance
- bondVault.sol : 158 lines : Holds User Funds : High Importance
- poolFactory.sol : 150 lines : Deploys Pools : Low Importance
- synthFactory.sol : 78 lines : Deploys Synths : Low Importance
- Utils.sol : 217 lines : Core Maths and helper functions: Medium Importance

The Pool contracts use Thorchain's continuous liquidity pools (CLP) model. https://docs.thorchain.org/thorchain-finance/continuous-liquidity-pools
Contract is designed with a security model of "Money in - Money Out"
Pool contains the core design for synthetic assets. Sparta into the pool and call mintSynth(), pool sends LP tokens to the synth contract. Synth contract will mint the relevant requested amount of synths and attribute that to the user, via mint(). Synths are swapped back to layer 1 assets via POOL function: burnSynth() by sending synth tokens to the SYNTH then calling burnSynth(). It will find all spare synth tokens on its address, burn them, then send the LP tokens back to the pool to also be burnt and attribute the user their fair share of the requested BEP20 asset. A realise() function burns excess LP tokens to ensure the revenue is going to the liquidity providers in the underlying pools instead of the un-owned LP tokens held on the SYNTH contract

Router contract facilitates movement of funds from users into pools, containing business logic for adding/removing liquidity, swapping and managing synths. Router also distributes fee rewards to curated pools with swaps.

Dao contract is the source-of-truth for the location of the ROUTER, UTILS, DAOVAULT, POOLFACTORY, SYNTHFACTORY as well as distributing rewards and managing how the system upgrades itself. It has goverance features that use a member's claim on BASE in each pool to attribute voting weight. The DAO can upgrade itself, as well as ammend some features in the BASE contract.

Synth contract contains logic and holds LP tokens and state. Minting synths requires the relevant POOL to send LP units to the SYNTH contract.

DaoVault contract holds user's funds and state for members

SynthVault contract holds user's funds and state for members

BondVault contract holds user's funds and state for members

Utils contract works as both a web3 aggregrator (one call that makes several EVM calls, returning objects), as well as the core arithmetic of the system.

Three Protocol Tokens:
- SPARTA as the base asset : ERC-20 + ERC-677 Standard
- Pool LP units issued as ERC-20 tokens. Identified by "tokenSymbol-SPP"
- Synthetic assets issued as ERC-20 tokens. Identified by "tokenSymbol-SPS"

Important Areas Of Concern:
- Pool contract - Draining liquidity
- Dao contract - Protocol manipulation
- SynthVault - Abusing rewards - can it be manipulated by flash loans? can funds be stuck?
- DaoVault - Abusing rewards and gaining protocol level control, can funds be stuck?
- BondVault - Leaving vault before bonding period is finished, can funds be stuck?
- Router - Fee Manipulation
