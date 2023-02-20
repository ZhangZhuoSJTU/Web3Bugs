# Livepeer contest details
- $52,250 USDC + $19,000 LPT main award pot
- $2,750 USDC + $1,000 LPT gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-livepeer-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 13, 2022 00:00 UTC
- Ends January 19, 2022 23:59 UTC

# Background

The contracts under audit implement the functionality required for the [LIP-73 - Arbitrum One Migration](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-73.md) upgrade for the Livepeer protocol that is currently implemented by a set of protocol contracts deployed on L1 Ethereum. The goal of the upgrade is to migrate users to protocol contracts deployed on Arbirum One which will be referred to as L2 going forward.

The primary focus of this audit is on the new LIP-73 contracts that will be deployed on L1 and L2 that facilitate various L1 <> L2 workflows. However, a number of these contracts also make external calls to either certain protocol contracts that are already deployed on L1 or protocol contracts that will be deployed on L2. For an overview of the functionality of these protocol contracts, refer to [this spec](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md). For a general overview of the protocol, refer to [the primer](https://livepeer.org/primer).

The recommendation for wardens is to focus on the LIP-73 contracts - links to the protocol contracts are provided as well for background/reference, however, if there are any findings surfaced in those contracts during the contest those are certainly welcome as well.

# Contract Overview

The `L1LPTGateway`, `L2LPTGateway`, `L1Escrow` architecture is based off of the [Dai bridge architecture](https://github.com/makerdao/arbitrum-dai-bridge).

Note: LOC includes comments.

**arbitrum-lpt-bridge**

The code for these contracts can be checked out at a code frozen Git commit hash:

```
git clone https://github.com/livepeer/arbitrum-lpt-bridge
git checkout ebf68d11879c2798c5ec0735411b08d0bea4f287
```

| Contract Name           | LOC |
| ----------------------- | --- |
| LivepeerToken.sol       | 44  |
| L1Escrow.sol            | 29  |
| L1LPTGateway.sol        | 240 |
| L2LPTGateway.sol        | 181 |
| L1Migrator.sol          | 529 |
| L2Migrator.sol          | 320 |
| DelegatorPool.sol       | 113 |
| L1LPTDataCache.sol      | 71  |
| L2LPTDataCache.sol      | 96  |
| L1ArbitrumMessenger.sol | 78  |
| L2ArbitrumMessenger.sol | 44  |
| IL1LPTGateway.sol       | 46  |
| IL2LPTGateway.sol       | 44  |
| IMigrator.sol           | 46  |
| ILivepeerToken.sol      | 14  |
| ControlledGateway.sol   | 33  |

`LivepeerToken.sol`
- To be deployed on L2
- ERC-20 compliant
- Role based authorization for minting and burning
- Supports `permit` based approvals with EIP-712 signatures
- Libraries
  - OpenZeppelin
    - AccessControl
    - ERC20
    - ERC20Permit

`L1Escrow.sol`
- To be deployed on L1
- Escrows L1 LPT for the `L1LPTGateway` for L1 -> L2 LPT transfers and L2 -> L1 LPT withdrawals
- Libraries
  - OpenZeppelin
    - AccessControl

`L1LPTGateway.sol` and `L2LPTGateway.sol`
- To be deployed on L1 and L2 respectively
- Handle L1 -> L2 LPT transfers and L2 -> L1 LPT withdrawals
- Inherits from `L1ArbitrumMessenger.sol` and `L2ArbitrumMessenger.sol` respectively
- Implements `IL1LPTGateway.sol` and `IL2LPTGateway.sol` respectively
- `L1LPTGateway.sol` external calls
  - L1 LivepeerToken [1]
  - `BridgeMinter.sol`
- `L2LPTGateway.sol` external calls
  - `LivepeerToken.sol`
  - `L2LPTDataCache.sol`

`L1Migrator.sol` and `L2Migrator.sol`
- To be deployed on L1 and L2 respectively
- Handle L1 -> L2 transcoder/delegator, unbonding locks and deposit/reserve migrations
- Handle L1 -> L2 ETH and LPT (L1 protocol funds) migrations
- Inherits from `L1ArbitrumMessenger.sol` and `L2ArbitrumMessenger.sol` respectively
- Both implement `IMigrator.sol`
- `L1Migrator.sol` external calls
  - L1 BondingManager [1]
  - L1 TicketBroker [1]
  - L1 LivepeerToken [1]
  - `L1LPTGateway.sol`
  - `BridgeMinter.sol`
- `L2Migrator.sol` external calls
  - L2 BondingManager [2]
  - L2 TicketBroker [2]
  - L2 MerkleSnapshot [2]
  - `DelegatorPool.sol`
- `L1Migrator.sol` libraries
  - OpenZeppelin
    - EIP712
    - Pausable
    - AccessControl
    - ECDSA
- `L2Migrator.sol` libraries
  - OpenZeppelin
    - Clones
    - AccessControl

`DelegatorPool.sol`
- To be deployed on L2
- New instances are deployed by `L2Migrator` to own the delegated stake of migrated transcoders in the L2 BondingManager so that delegators can claim their stake if they migrate later on
- External calls
  - L2 BondingManager [2]
- Libraries
  - OpenZeppelin
    - Initializable

`L1LPTDataCache.sol` and `L2LPTDataCache.sol`
- To be deployed on L1 and L2 respectively
- Handle L1 -> L2 reporting of L1 LPT total supply so that it can be cached on L2
- Inherits from `L1ArbitrumMessenger.sol` and `L2ArbitrumMessenger.sol` respectively
- `L1LPTDataCache.sol` external calls
  - L1 LivepeerToken [1]
- `L2LPTDataCache.sol` external calls
  - `L2LPTGateway.sol`
- `L2LPTDataCache.sol` libraries
  - OpenZeppelin
    - Ownable

`L1ArbitrumMessenger.sol`
- Abstract contract with helpers for cross-chain transactions and sending L1 -> L2 transactions
- External calls
  - Inbox [3]
  - Outbox [3]
  - Bridge [3]

`L2ArbitrumMessenger.sol`
- Abstract contract with helpers for cross-chain transactions and sending L2 -> L1 transactions
- External calls
  - ArbSys [3]

`IL1LPTGateway.sol`
- Interface for `L1LPTGateway.sol`

`IL2LPTGateway.sol`
- Interface for `L2LPTGateway.sol`

`IMigrator.sol`
- Interface with shared data structures for `L1Migrator.sol` and `L2Migrator.sol`

`ILivepeerToken.sol`
- Interface for `LivepeerToken.sol`

`ControlledGateway.sol`
- Base contract with ACL and pausing logic that is inherited by `L1LPTGateway` and `L2LPTGateway`
- Libraries
  - OpenZeppelin
    - AccessControl
    - Pausable

[1] L1 protocol contract
[2] L2 protocol contract
[3] Arbitrum

**protocol**

The code for these contracts can be checked out at a code frozen Git commit hash:

```
git clone https://github.com/livepeer/protocol
git checkout 20e7ebb86cdb4fe9285bf5fea02eb603e5d48805
```

| Contract Name    | LOC |
| ---------------- | --- |
| BridgeMinter.sol | 138 |
| Manager.sol      | 63  |
| IManager.sol     | 8   |
| IController.sol  | 17  |

`BridgeMinter.sol`
- To be deployed on L1
- Handles minting L1 LPT
- Holds ETH and LPT from the L1 protocol that should be sent to L2
- Inherits from `Manager.sol`
- External calls
  - L1 LivepeerToken [1]

`Manager.sol`
- Base contract with functionality for being managed by a Controller contract

`IManager.sol`
- Interface for `Manager.sol`

`IController.sol`
- Interface for Controller

## External Dependencies

**L1 protocol contracts**

The contracts mentioned that are called by the LIP-73 contracts are:

- L1 LivepeerToken
  - [L1 deployment](https://etherscan.io/address/0x58b6a8a3302369daec383334672404ee733ab239)
  - [Repo code](https://github.com/livepeer/protocol/blob/streamflow/contracts/token/LivepeerToken.sol)
- L1 BondingManager
  - [L1 deployment](https://etherscan.io/address/0x5fe3565db7f1dd8d6a9e968d45bd2aee3836a1d4)
    - The L1 deployment is used via a [delegatecall proxy](https://etherscan.io/address/0x511bc4556d823ae99630ae8de28b9b80df90ea2e)
  - [Repo code](https://github.com/livepeer/protocol/blob/streamflow/contracts/bonding/BondingManager.sol)
- L1 TicketBroker
  - [L1 deployment](https://etherscan.io/address/0x6F582E2bB19ac31D4B1e6eDD0c2eFEabD700f808)
    - The L1 deployment is used via a [delegatecall proxy](https://etherscan.io/address/0x5b1ce829384eebfa30286f12d1e7a695ca45f5d2)
  - [Repo code](https://github.com/livepeer/protocol/blob/streamflow/contracts/pm/TicketBroker.sol)

The repo that contains these contracts is https://github.com/livepeer/protocol at Git commit hash 20e7ebb86cdb4fe9285bf5fea02eb603e5d48805.

**L2 protocol contracts**

The contracts mentioned that are called by the LIP-73 contracts are:

- L2 BondingManager
  - [Repo code](https://github.com/livepeer/protocol/blob/confluence/contracts/bonding/BondingManager.sol)
- L2 TicketBroker
  - [Repo code](https://github.com/livepeer/protocol/blob/confluence/contracts/pm/TicketBroker.sol)
- L2 MerkleSnapshot
  - [Repo code](https://github.com/livepeer/protocol/blob/confluence/contracts/snapshots/MerkleSnapshot.sol)
- L2 Minter
  - [Repo code](https://github.com/livepeer/protocol/blob/confluence/contracts/token/Minter.sol)

The repo that contains these contracts is https://github.com/livepeer/protocol/tree/confluence at Git commit hash 439445f3ab6ef88f490ee2fdafb84c7d8fee76f3.

**Arbitrum**

The contracts mentioned that are called by the LIP-73 contracts are:

- Inbox 
  - [L1 deployment](https://etherscan.io/address/0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f)
  - [Repo code](https://github.com/OffchainLabs/arbitrum/blob/master/packages/arb-bridge-eth/contracts/bridge/Inbox.sol)

Additional resources for Arbitrum can be found at:

- https://developer.offchainlabs.com/docs/mainnet
- https://developer.offchainlabs.com/docs/public_testnet
- https://github.com/OffchainLabs/arbitrum/tree/master/packages/arb-bridge-eth

# System Overview

A few of the sections below mention the `L1GatewayRouter` and `L2GatewayRouter` contracts which are deployed by Offchain Labs to map L1/L2 tokens with L1/L2 gateway contracts. Additional information about these contracts can be found in the [Arbitrum docs](https://developer.offchainlabs.com/docs/bridging_assets). The rest of this document assumes that the `L1GatewayRouter` and `L2GatewayRouter` map L1 LPT and L2 LPT correctly to `L1LPTGateway` and `L2LPTGateway` contracts such that if users choose to transfer LPT between L1 and L2 using `L1GatewayRouter` or `L2GatewayRouter` the `L1LPTGateway` and `L2LPTGateway` contracts will be used under the hood.

Additionally, note that the state of any L1 protocol contract that is referenced below will be frozen prior to the execution of these mechanisms.

## LiveperToken ACL

`LivepeerToken` uses role based authorization to determine which addresses are authorized to mint and burn LPT.

The following contracts will have the minter role:

- `L2LPTGateway`
- L2 Minter

The following contracts will have the burner role:

- `L2LPTGateway`

## L1 -> L2 LPT Transfer

This mechanism allows users to transfer liquid LPT from L1 to L2.

The following occurs when LPT is transferred from L1 to L2:

1. The user approves the `L1LPTGateway` to transfer LPT
2. The user initiates a transfer for X LPT. This can be done in two ways:
  a. Call `outboundTransfer()` on `L1GatewayRouter` which will call `outboundTransfer()` on `L1LPTGateway`
  b. Call `outboundTransfer()` directly on `L1LPTGateway`
3. `L1LPTGateway` calls `transferFrom()` on L1 LPT to transfer X LPT from the user to `L1Escrow`
4. `L1LPTGateway` sends a `finalizeInboundTransfer()` message to `L2LPTGateway`
5. When `finalizeInboundTransfer()` is executed on `L2LPTGateway` it will mint X L2 LPT to the user

The below diagram illustrates the workflow for transferring liquid LPT from L1 to L2. Note that in this diagram the user initiates the transfer via the `L1GatewayRouter` instead of calling `L1LPTGateway` directly.

![L1 -_ L2 LPT Bridging drawio (1)](https://user-images.githubusercontent.com/5933273/149050466-2ab2e7e9-95d0-4560-a9d0-ac566a6ae388.png)

## L2 -> L1 LPT Withdrawal

This mechanism allows users to withdraw liquid LPT from L2 to L1.

The following occurs when LPT is withdrawn from L2 to L1:

1. The user initiates a withdrawal for X LPT. This can be done in two ways:
  a. Call `outboundTransfer()` on `L2GatewayRouter` which will call `outboundTransfer()` on `L2LPTGateway`
  b. Call `outboundTransfer()` directly on `L2LPTGateway`
2. `L2LPTGateway` burns X LPT from the user's balance
3. `L2LPTGateway` sends a `finalizeInboundTransfer()` message to `L1LPTGateway` which is executed after Arbitrum's challenge period

At this point, there are two possible scenarios described below.

**Transferring LPT from L1Escrow**

In this scenario, the `L1Escrow` has enough L1 LPT to cover the withdrawal.

The following will occur:

1. `L2LPTGateway` calls `transferFrom()` on L1 LPT to transfer X LPT from `L1Escrow` to the user

The below diagram illustrates the workflow for withdrawing liquid LPT from L2 to L1. Note that in this diagram the user initiates the withdrawal via the `L2GatewayRouter` instead of calling `L2LPTGateway` directly.

![L2 -_ L1 LPT Bridging drawio (1)](https://user-images.githubusercontent.com/5933273/149050442-2c302b56-e5ea-4d4c-8054-d36d0ed48f3c.png)

**Minting LPT via BridgeMinter**

In this scenario, the `L1Escrow` does not have enough L1 LPT to cover the withdrawal. This is possible because L2 LPT is inflationary and its total supply will increase over time such that there is not a 1:1 correspondance between L1 LPT in `L1Escrow` and L2 LPT in existance. 

The following will occur:

1. `L2LPTGateway` calls `bridgeMint()` on the `BridgeMinter` to mint `X - L1LPT.balanceOf(L1Escrow)` to the user
2. `L2LPTGateway` calls `transferFrom()` on L1 LPT to transfer `L1LPT.balanceOf(L1Escrow)` to the user

The below diagram illustrates the workflow for withdrawing liquid LPT from L2 to L1. Note that in this diagram the user initiates the withdrawal via the `L2GatewayRouter` instead of calling `L2LPTGateway` directly.

![L2 -_ L1 LPT Bridge Mint drawio](https://user-images.githubusercontent.com/5933273/149050417-93b3c7fa-b7de-4ee1-b49f-00eb3af60964.png)

## L1 -> L2 Protocol Funds Migration

This mechanism allows the ETH and LPT locked for the L1 protocol to be migrated to the `L2Migrator` in order to:

- Allow the `L2Migrator` to distribute ETH fees owed to transcoders and delegators from L1
- Allow the `L2Migrator` to fund a broadcaster's deposit and reserve based on its deposit and reserve from L1
- Allow the `L2Migrator` to add LPT to a transcoder/delegator's stake based on their stake and unbonding locks on L1

In order to complete the above operations, the `L2Migrator` must receive the ETH and LPT held by the `BridgeMinter` for the L1 protocol.

**Migrating ETH**

The following occurs when ETH is migrated from the `BridgeMinter` on L1 to the `L2Migrator`:

1. Anyone calls `migrateETH()` on the `L1Migrator`
2. `L1Migrator` calls `withdrawETHToL1Migrator()` on the `BridgeMinter` which sends the `BridgeMinter`'s ETH balance to `L1Migrator`
3. `L1Migrator` sends a cross-chain transaction with the ETH received from the `BridgeMinter` to the `L2Migrator`

The below diagram illustrates the workflow for migrating ETH from L1 to L2.

![L1 -_ L2 ETH Migration drawio](https://user-images.githubusercontent.com/5933273/149050402-0fd0f07e-afa1-4957-adf0-5c405aa97219.png)

**Migrating LPT**

The following occurs when LPT is migrated from the `BridgeMinter` on L1 to the `L2Migrator`:

1. Anyone calls `migrateLPT()` on the `L2Migrator`
2. `L1Migrator` calls `withdrawLPTToL1Migrator()` on the `BridgeMinter` which sends the `BridgeMinter`'s LPT balance to `L1Migrator`
3. `L1Migrator` calls `outboundTransfer()` on the `L1LPTGateway` for the LPT received from the `BridgeMinter`
4. The rest of the flow follows the steps described in "Transferring L1 -> L2 LPT Transfer" for passing a message from the `L1LPTGateway` to the `L2LPTGateway`

The below diagram illustrates the workflow for migrating LPT from L1 to L2.

![L1 -_ L2 LPT Migration drawio](https://user-images.githubusercontent.com/5933273/149050368-65cfb828-4f9f-4724-85d7-f32573dc9449.png)

## L1 -> L2 LPT Total Supply Caching

This mechanism allows contracts on L2 to be aware of the L1 LPT circulating supply which is defined as the amount of L1 LPT for which there is no L2 LPT (i.e. the L1 LPT that has not been escrowed in `L1Escrow` as a part of a L1 -> L2 transfer). The L1 circulating supply can then be added with the L2 total supply to calculate the L1 + L2 total supply. Since L2 contracts cannot directly read the state of L1 contracts, we use a `L1LPTDataCache` to read the L1 total supply and send that data to `L2LPTDataCache` so that it can be cached and read by L2 contracts. Additionally, the `L2LPTDataCache` keeps track of `l2SupplyFromL1`, the L2 supply that comes from L1. So, once the L1 total supply is cached in `L2LPTDataCache`, the `L2LPTDataCache` can calculate the L1 circulating supply by subtracting `l2SupplyFromL1` from its cached L1 total supply.

The following occurs during L1 -> L2 LPT transfers:

1. When `L2LPTGateway` executes `finalizeInboundTransfer()` for X LPT, it also calls `increaseL2SupplyFromL1()` on `L2LPTDataCache` to increase `l2SupplyFromL1` by X

The following occurs during L2 -> L1 LPT withdrawals:

1. When `L2LPTGateway` executes `outboundTransfer()` for X LPT, it also calls `decreaseL2SupplyFromL1()` on `L2LPTDataCache` to decrease `l2SupplyFromL1` by X. If `X > l2SupplyFromL1`, `l2SupplyFromL1` is set to 0 - this can happen if there is a mass withdrawal from L2 resulting in all the L2 supply from L1 being drained with the remaining L2 total supply being inflationary LPT that was minted on L2

The following occurs when the L1 total supply is cached on L2:

1. Anyone calls `cacheTotalSupply()` on `L1LPTDataCache`. This can happen if the L1 total supply ever changes (i.e. if L1 LPT is minted or burned)
2. `L1LPTDataCache` calls `totalSupply()` on L1 LPT
3. `L1LPTDataCache` sends the value of `totalSupply()` for L1 LPT in a `finalizeCacheTotalSupply()` message to `L2LPTDataCache`
4. When `finalizeCacheTotalSupply()` is executed on `L2LPTDataCache`, it stores the L1 total supply

When anyone calls `l1CirculatingSupply()` on `L2LPTDataCache`, it will return its stored L1 total supply minus the `l2SupplyFromL1`.

The below diagram illustrates the workflow for caching the L1 total supply on L2 so that it can be used to calculate the L1 circulating supply on L2.

![L1 -_ L2 LPT Total Supply Caching drawio](https://user-images.githubusercontent.com/5933273/149050346-695b89e9-aa5c-4bb2-b516-3cd875af56e4.png)

## L1 -> L2 Transcoder/Delegator Migration

This mechanism is used to migrate the state of transcoders/delegators from L1 to L2. The relevant state that needs to be read from L1 and relayed to L2 consists of:

- The address' stake in the L1 BondingManager (via `BondingManager.pendingStake()`)
- The address' fees in the L1 BondingManager (via `BondingManager.pendingFees()`)
- The address' delegated stake in the L1 BondingManager (via the `delegatedAmount` field in `BondingManager.getDelegator()`)
- The address' delegate in the L1 BondingManager (via the `delegateAddress` field in `BondingManager.getDelegator()`)

An address can authorize a migration by either:

- Calling `migrateDelegator()` on the `L1Migrator`
- Creating a EIP-712 signature with a payload that includes the address as well as the address that should own the stake from L1 and receive the fees from L1

The following occurs when an address migrates:

1. The address authorizes a migration with one of the options mentioned above
2. `L1Migrator` reads the relevant state from the L1 BondingManager
3. `L1Migrator` sends a `finalizeMigrateDelegator()` message to `L2Migrator` with the relevant state
4. `L2Migrator` checks if the address already migrates. If so, revert
5. `L2Migrator` marks the address as migrated
6. `L2Migrator` tracks the migrated stake of delegators for each transcoder and increases this amount by the stake being migrated

Then, the next steps differ depending on if the address is a transcoder vs. a delegator.

**Transcoders**

If an address's delegate is itself on L1 then it is considered a transcoder.

The following occurs when a transcoder migrates:

1. `L2Migrator` calls `bondForWithHint()` on the L2 BondingManager to add the migrated stake to the specified L2 address' stake with the delegate set to the L2 address
2. `L2Migrator` creates a `DelegatorPool` contract which exposes a single `claim()` function that can only be called by `L2Migrator`
3. `L2Migrator` calls `bondForWithHint()` on the L2 BondingManager to add the migrated delegated stake to `DelegatorPool`'s stake with the delegate set to the L2 address
  a. If delegators from L1 previously already migrated, the sum of their migrated stake should be subtracted from the amount the transcoder's migrated delegated stake

**Delegators**

If an address' delegate is NOT itself on L1 then it is considered a delegator.

The following occurs when a delegator migrates:

1. If the L1 delegate has migrated and has a `DelegatorPool` contract, `L2Migrator` calls `claim()` on the `DelegatorPool` to transfer the owed stake and fees to the delegator
  a. `DelegatorPool` will calculate the owed stake and fees to to the delegator proportional to the migrated stake divided by the initial stake of the `DelegatorPool`
2. Otherwise, `L2Migrator` calls `bondForWithHint()` on the L2 BondingManager to add the migrated stake to the specified L2 address' stake with the delegate set to the L1 delegate

**Fees**

If the address had fees on L1, `L2Migrator` sends the fees directly to the specified L2 address.

## L2 Stake Claiming w/ Snapshot

This mechanism is used by delegators to directly submit a transaction on L2 to claim their stake from L1. This is only an option for delegators that are EOAs on L1 - delegators that are contracts must call `migrateDelegator()` on the `L1Migrator`. A Merkle tree based snapshot is created with the leaves of the tree containing the following information about delegators on L1 at a particular point in time:

- The address' stake in the L1 BondingManager (via `BondingManager.pendingStake()`)
- The address' fees in the L1 BondingManager (via `BondingManager.pendingFees()`)
- The address' delegated stake in the L1 BondingManager (via the `delegatedAmount` field in `BondingManager.getDelegator()`)
- The address' delegate in the L1 BondingManager (via the `delegateAddress` field in `BondingManager.getDelegator()`) 

The leaf format for the Merkle tree will be:

```
keccak256(abi.encodePacked(
    delegator,
    delegate,
    stake,
    fees
))
```

The root of this tree is stored in a L2 MerkleSnapshot contract. 

The code that will be used to generate the Merkle tree snapshot is at https://github.com/livepeer/merkle-earnings-cli/tree/LIP-73.

The following occurs when a delegator directly claims stake on L2:

1. The address calls `claimStake()` on the `L2Migrator` with a Merkle proof that the address and its state is included in the root stored in the L2 MerkleSnapshot contract
2. `L2Migrator` verifies the Merkle proof - if verification fails, revert
3. `L2Migrator` checks if the address already migrated. If so, revert
4. `L2Migrator` marks the address as migrated
6. `L2Migrator` tracks the migrated stake of delegators for each transcoder and increases this amount by the stake being migrated
7. If the L1 delegate has migrated and has a `DelegatorPool` contract, `L2Migrator` calls `claim()` on the `DelegatorPool` to transfer the owed stake and fees to the delegator
  a. `DelegatorPool` will calculate the owed stake and fees to to the delegator proportional to the migrated stake divided by the initial stake of the `DelegatorPool`
8. Otherwise, `L2Migrator` calls `bondForWithHint()` on the L2 BondingManager to add the migrated stake to the address' stake in the L2 BondingManager with the delegate set to the L1 delegate or a new delegate if specified

## L1 -> L2 Unbonding Locks Migration

This mechanism is used to migrate an address' unbonding locks in the L1 BondingManager to L2. The L1 BondingManager uses the term "unbonding locks" to refer to amounts of LPT that was previously staked and are currently not withdrawable until the end of an unbonding period. Each lock is for a specific amount of LPT. The relevant state that needs to be read from L1 and relayed to L2 consists of:

- The sum of the amounts of each lock that is being migrated (via the `amount` field in `BondingManager.getDelegatorUnbondingLock()`)
- The address' delegate in the L1 BondingManager (via the `delegateAddress` field in `BondingManager.getDelegator()`)

An address can authorize a migration by either:

- Calling `migrateUnbondingLocks()` on the `L1Migrator`
- Creating a EIP-712 signature with a payload that includes the address as well as the address that should own the stake associated with the locks on L2 and the IDs of the unbonding locks that should be migrated

The following occurs when a unbonding locks migration is triggered:

1. An address authorizes a migration with one of the options mentioned above
2. `L1Migrator` reads the relevant state from the L1 BondingManager
3. `L1Migrator` sends a `finalizeMigrateUnbondingLocks()` message to `L2Migrator` with the relevant state
4. `L2Migrator` checks if any of the IDs of the unbonding locks have already migrated. If so, revert
5. Otherwise, mark the IDs as migrated and then call `bondForWithHint()` on the L2 BondingManager in order to add the sum of the amounts of each lock to the stake of the specified L2 address. The delegate of the stake is the address' L1 delegate address

As indicated above, the `L2Migrator` is responsible for preventing an address from migrating unbonding locks more than once.

## L1 -> L2 TicketBroker Deposit/Reserve Migration

This mechanism is used to migrate an address' deposit and reserve in the L1 TicketBroker to L2. The L1 TicketBroker uses the term "sender" to refer to an address that has a deposit and reserve. The relevant state that needs to be read from L1 and relayed to L2 consists of:

- The address' deposit in the L1 TicketBroker (via the `sender.deposit` field in `TicketBroker.getSenderInfo()`)
- The address' reserve in the L1 TicketBroker (via the `reserveInfo.fundsRemaining` field in `TicketBroker.getSenderInfo()`)

An address can authorize a migration by either:

- Calling `migrateSender()` on the `L1Migrator`
- Creating a EIP-712 signature with a payload that includes the address as well as the address that should own the deposit/reserve on L2

The following occurs when a deposit/reserve migration is triggered:

1. An address authorizes a migration with one of the options mentioned above
2. `L1Migrator` reads the relevant state from the L1 TicketBroker
3. `L1Migrator` sends a `finalizeMigrateSender()` message to `L2Migrator` with the relevant state
4. `L2Migrator` checks if the address has already migrates. If so, revert
5. Otherwise, mark the address as migrated and then call `fundDepositAndReserveFor()` on the L2 TicketBroker in order to fund the specified L2 address's deposit and reserve

As indicated above, the `L2Migrator` is responsible for preventing an address from migrating a L1 deposit/reserve more than once.

# Areas of Specific Concern

- Can a transcoder migrating from L1 end up with more stake or delegated stake on L2 immediately post-migration?
- Can a delegator migrating from L1 end up with more stake on L2 immediately post-migration?
- Can unbonding locks migrated from L1 result in an amount of stake on L2 that exceeds the sum of the lock amounts immediately post-migration?
- Can a deposit and reserve migrated from L1 result in a deposit and reserve on L2 that exceeds the amounts from L1 immediately post-migration?
- In `L2Migrator`, `finalizeMigrateDelegator()`, `finalizeMigrateSender()`, `finalizeUnbondingLocks()` should not be executed for an L1 address more than once. Is there any way to violate this property?
- In `L2Migrator`, if a L1 address is a delegator (and not a transcoder i.e. delegated to itself on L1), it should only be migrated via a `finalizeMigrateDelegator()` call or `claimStake()` call, but not both. Is there a way to violate this property?
- In `L2Migrator`, a new `DelegatorPool` is created to own the delegated stake of a migrated transcoder and the transcoder's delegators from L1 can claim their stake from the contract via `finalizeMigrateDelegator()` or `claimStake()`. Is it possible for anyone else to incorrectly claim the delegator's stake from a `DelegatorPool` contract?
- Can a `DelegatorPool` contract become stuck such that its stake and fees in the L2 BondingManager can never be transferred to delegators?
