# Minting and burning in Gravity

This document covers when, where, and how tokens are locked, unlocked and held in Gravity.
The task of any blockchain bridge is to hold tokens on one chain and issue representative
assets on the other chain. Unlocking the assets at some point in the future when they are
sent back across the bridge.

Since Gravity is a bi-directional bridge that handles two asset sources, Cosmos and Ethereum
tokens may be held on Ethereum or held on Cosmos based on where they originated. Likewise tokens
are minted on both sides as well, to represent the assets from the other chain.

## Ethereum based assets

### Ethereum -> Cosmos

An Ethereum asset implementing the ERC20 standard is deposited into the [Gravity.sol](/solidity/contracts/Gravity.sol) contract using the Solidity function call `sendToCosmos`. This locks the ERC20 asset in the Gravity.sol contract where it will remain until it is withdrawn at some undetermined point in the future.

At the send of the `sendToCosmos` function call an Ethereum event `SendToCosmosEvent` executes. This event contains the amount and type of tokes, as well as a destination address on Cosmos for the funds.

The validators all run their oracle processes which submit `MsgDepositClaim` messages describing the deposit they have observed. Once more than 66% of all voting power has submitted a claim for this specific deposit representative tokens are minted and issued to the Cosmos address that the sender requested.

For further details on oracle operation see [oracle](/docs/design/oracle.md)

### Cosmos -> Ethereum

The Cosmos representation of the Ethereum ERC20 token, hereafter called a `voucher`, has been used and exchanged on the Cosmos chain for some time. Eventually some owner wishes to cash in the `voucher` and withdraw the actual asset on Ethereum.

To do this they send a `MsgSendToEth` on the Cosmos chain. This removes the `voucher` from the users account and places a transaction into a transaction pool of `MsgSendToEth` messages for that same ERC20 token type.

As part of `MsgSendToEth` the user specifies a fee, there is no mandatory minimum fee. But this fee must be paid in the same ERC20 asset they are returning to Ethereum (for the reasoning view the [transaction batch rewards](/docs/design/mint-and-lock.md/###transaction-batch-rewards)).

At some point in the future a relayer will determine that the pool contains enough transactions to bother executing a batch of that type and relay it to Ethereum. For a discussion of edge cases here see the [batch creation spec](/spec/batch-creation-spec.md)

When the batch transaction executes on the Ethereum chain the ERC20 token will be sent out the bridge to the Ethereum destination specified by the user in `MsgSendToEth`. An Ethereum event `TransactionBatchExecutedEvent` will be fired and picked up by the validators oracle processes. Once the resulting `MsgWithdrawClaim` has passed the `voucher` will finally be burned.

Note that batching logic reduces costs dramatically, over 75%, but at the cost of latency and implementation complexity. If a user wishes to withdraw quickly they will have to pay a much higher fee. But this fee will be about the same as the fee every withdraw from the bridge would require in a non-batching system.

## Cosmos based assets

### Cosmos -> Ethereum

A Cosmos asset first must be represented on Ethereum before it's possible to bridge it. To do this the [Gravity.sol](/solidity/contracts/Gravity.sol) contract contains an endpoint called `deployERC20`.

This endpoint is not permissioned. It is possible for anyone to pay for the creation of a new ERC20 representing a Cosmos asset, but it is up to the validators and the Gravity Cosmos module to declare any given ERC20 as the representation of a given asset.

When a user on Ethereum calls `deployERC20` they pass arguments describing the desired asset. [Gravity.sol](/solidity/contracts/Gravity.sol) uses an ERC20 factory to deploy the actual ERC20 contract using a known good code and assigns ownership of the entire balance of the new token to itself before firing a `ERC20DeployedEvent`

The validators oracle processes observe this event and decide if a Cosmos asset has been accurately represented (correct decimals, correct name, no existing representation). If this is the case the ERC20 contract address is adopted and stored as the definitive representation of that Cosmos asset on Ethereum.

For further details on oracle operation see [oracle](/docs/design/oracle.md)

From this point on the process is nearly identical to the Cosmos -> Ethereum process for Ethereum originated assets.

The user sends a `MsgSendToEth` that specifies a fee denominated in the token they are sending across the bridge. (for the
reasoning view the [transaction batch rewards](/docs/design/mint-and-lock.md/###transaction-batch-rewards))

At some point in the future a relayer will determine that the pool contains enough transactions to bother executing a batch of that type and relay it to Ethereum. For a discussion of edge cases here see the [batch creation spec](/spec/batch-creation-spec.md)

When the batch transaction executes on the Ethereum chain the ERC20 token will be sent out the bridge to the Ethereum destination specified by the user in `MsgSendToEth`. An Ethereum event `TransactionBatchExecutedEvent` will be fired and picked up by the validators oracle processes. Once the resulting `MsgWithdrawClaim` has passed the Cosmos asset will be locked in the Gravity module to later be unlocked once it is returned to Cosmos.

The tl;dr of this process is that the 'minting' of Cosmos assets on Ethereum is done all at once and the total balance simply exists in the [Gravity.sol](/solidity/contracts/Gravity.sol) contract at all times, which 'mints' them by sending them out and 'burns' them by locking them up again.

As a related consequence this means that the supply of a given Ethereum asset on Cosmos is correct, but the supply of a given Cosmos asset on Ethereum is the total number of tokens minus the number in the Gravity bridge address.

### Ethereum -> Cosmos

This is identical to Ethereum -> Cosmos for Ethereum based assets. Please see that section and refer to the above section for details on how the overall process differs for Cosmos assets.

## Relaying rewards

### Validator set update rewards

Validator set rewards are an optional chain [parameter](/docs/design/parameters.md). By default no reward is issued, it's important to maintain this behavior as the [Gravity.sol](/solidity/contracts/Gravity.sol) is not deployed containing any assets.

At some point in the future a governance vote may select some Cosmos originated asset to use as a reward for submitting `valsetUpdate` transactions. From that point onward the specified amount of ERC20 tokens representing a Cosmos asset will be sent to `msg.sender` when submitting the `valsetUpdate` transaction to [Gravity.sol](/solidity/contracts/Gravity.sol) (see [incentives](/design/incentives.md##relaying-rewards) documentation for reasoning).

Only Cosmos originated assets are allowed. So the ERC20 deployment process described in [Cosmos -> Ethereum](<(/docs/design/mint-lock.md##cosmos-based-assets)>) must occur first.

By using a Cosmos originated asset we can effectively mint it on Ethereum indefinitely. After each `valsetUpdate` an Ethereum event `ValsetUpdateEvent` is fired, observed by the validators oracle process, and used to increment the total supply of that asset appropriately, locking the newly issued tokens in the Gravity module for later unlock.

Minting tokens on another chain is not unusual for a bridge. The unusual part of this design is that we don't know exactly how many tokens we will end up minting. Relayers are free to submit every validator set, or only the latest if the voting power hasn't changed by a large amount.

This is why we do not allow Ethereum originated assets to be used in this way. Maintaining the balance of the chosen Ethereum asset in the Gravity module bank would become an active effort and if the balance became insufficient validator set updates would fail, potentially causing the validators to lose control of the chain.

### Transaction Batch rewards

Transaction batch rewards are the sum of all `MsgSendToEth` fees for the transactions in a given batch. These fees are paid out directly to `msg.sender` on the Ethereum chain (see [incentives](/docs/design/incentives.md##relaying-rewards) documentation for reasoning).

Currently [Gravity.sol](/solidity/contracts/Gravity.sol) is hardcoded to only accept batches with a single token type and only pay rewards in that same token type. This is logically very simple.

[Arbitrary logic calls](/docs/design/mint-lock.md###arbitrary-logic-call-rewards) provide a way to structure a multi-token batch or even simply a multi-reward batch that future versions of Gravity may use.

### Arbitrary Logic call rewards

Arbitrary logic calls do exactly what their name implies. Allow for the execution of arbitrary ethereum code passed in as a bytes payload and target contract.

Rewards for arbitrary logic calls are set on creation, like batches. But unlike batches arbitrary logic calls accept a list of ERC20 tokens and amounts to pay out as fees. Allowing for the relayer to potentially be paid many different types of tokens at the same time as a reward.

Note that just because you can pay out an arbitrary number of tokens as a reward for a single TX does not mean you should. Each different type of reward token is an additional ERC20 transfer fee and if each reward is low enough it's possible that relayers will decide against relaying as no reward is worth more than the gas it costs to sell.

Currently arbitrary logic is only used by Cosmos modules outside of Gravity that want to interact with Ethereum. Although user callable arbitrary logic is being considered from a security perspective.
