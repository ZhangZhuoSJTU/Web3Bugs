# Axelar contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-axelar-network-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 7, 2022 00:00 UTC
- Ends April 11, 2022 23:59 UTC

# Contest Scope

The contest will focus on Axelar's gateway smart contracts that are deployed on EVM chains
that process messages generated from the Axelar network (such as minting a certain token),
and accept messages/token deposits from users/applications.

# Protocol overview

Axelar is a decentralized interoperability network connecting all blockchains, assets and apps through a universal set of protocols and APIs.
It is built on top off the Cosmos SDK. Users/Applications can use Axelar network to send tokens between any Cosmos and EVM chains. They can also
send arbitrary messages between EVM chains.

Axelar network's decentralized validators confirm events emitted on EVM chains (such as deposit confirmation and message send),
and sign off on commands submitted (by automated services) to the gateway smart contracts (such as minting token, and approving message on the destination).

## Design Notes

- `AxelarGatewayMultisig.execute()` takes a signed batched of commands.
  Each command has a corresponding `commandID`. This is guaranteed to be unique from the Axelar network. `execute` intentionally allows retrying
  a `commandID` if the `command` failed to be processed; this is because commands are state dependent, and someone might submit command 2 before command 1 causing it to fail.
- Axelar network supports sending any Cosmos/ERC-20 token to any other Cosmos/EVM chain.
- Supported tokens have 3 different types:
  - `External`: An external ERC-20 token on it's native chain is registered as external, e.g. `USDC` on Ethereum.
  - `InternalBurnableFrom`: Axelar wrapped tokens that are minted by the Axelar network when transferring over the original token, e.g. `axlATOM`, `axlUSDC` on Avalanche.
  - `InternalBurnable`: `v1.0.0` version of Axelar wrapped tokens that used a different deposit address contract, e.g. `UST` (native to Terra) on Avalanche.
  New tokens cannot be of this type, and this is only present for legacy support.
- Deploying gateway contract:
  - Deploy the `TokenDeployer` contract.
  - Deploy the `AxelarGatewayMultisig` contract with the token deployer address.
  - Deploy the `AxelarGatewayProxy` contract with the implementation contract address (from above) and `setup` params obtained from the current network state.

## Example flows

### Token transfer

1. Setup: A wrapped version of Token `A` is deployed (`AxelarGatewayMultisig.deployToken()`)
   on each non-native EVM chain as an ERC-20 token (`BurnableMintableCappedERC20.sol`).
2. Given the destination chain and address, Axelar network generates a deposit address (the address where `DepositHandler.sol` is deployed,
   `BurnableMintableCappedERC20.depositAddress()`) on source EVM chain.
3. User sends their token `A` at that address, and the deposit contract locks the token at the gateway (or burns them for wrapped tokens).
4. Axelar network validators confirm the deposit `Transfer` event using their RPC nodes for the source chain (using majority voting).
5. Axelar network prepares a mint command, and validators sign off on it.
6. Signed command is now submitted (via any external relayer) to the gateway contract on destination chain `AxelarGatewayMultisig.execute()`.
7. Gateway contract authenticates the command, and `mint`'s the specified amount of the wrapped Token `A` to the destination address.

### Cross-chain smart contract call

1. Setup:
   1. Destination contract implements the `IAxelarExecutable.sol` interface to receive the message.
   2. If sending a token, source contract needs to call `ERC20.approve()` beforehand to allow the gateway contract
   to transfer the specified `amount` on behalf of the sender/source contract.
2. Smart contract on source chain calls `AxelarGateway.callContractWithToken()` with the destination chain/address, `payload` and token.
3. An external service stores `payload` in a regular database, keyed by the `hash(payload)`, that anyone can query by.
4. Similar to above, Axelar validators confirm the `ContractCallWithToken` event.
5. Axelar network prepares an `AxelarGatewayMultisig.approveContractCallWithMint()` command, signed by the validators.
6. This is submitted to the gateway contract on the destination chain,
   which records the approval of the `payload hash` and emits the event `ContractCallApprovedWithMint`.
7. Any external relayer service listens to this event on the gateway contract, and calls the `IAxelarExecutable.executeWithToken()`
   on the destination contract, with the `payload` and other data as params.
8. `executeWithToken` of the destination contract verifies that the contract call was indeed approved by calling `AxelarGateway.validateContractCallAndMint()`
   on the gateway contract.
9. As part of this, the gateway contract records that the destination address has validated the approval, to not allow a replay.
10. The destination contract uses the `payload` for it's own application.

### Cross-chain NFT transfer/minter

See this [example](https://github.com/axelarnetwork/axelar-local-dev/tree/main/examples/nftLinker) cross-chain NFT application.

# Smart Contracts

The following contracts are in-scope for the audit.
The remaining code in the repo is only relevant for tests, utils, samples etc., and not in scope.

Note: Known issues posted on GitHub aren't considered valid findings: https://github.com/axelarnetwork/axelar-cgp-solidity/issues

### Interfaces

#### IAxelarGateway.sol (122 sloc)

#### IAxelarGatewayMultisig.sol (17 sloc)

#### IERC20.sol (15 sloc)

#### IERC20BurnFrom.sol (4 sloc)

#### IAxelarExecutable.sol (56 sloc)

This interface needs to be implemented by the application contract
to receive cross-chain messages. See the
[token swapper example](src/test/DestinationSwapExecutable.sol) for an example.

### Contracts

#### AxelarGatewayProxy.sol (34 sloc)

Our gateway contracts implement the proxy pattern to allow upgrades.
Calls are delegated to the implementation contract while using the proxy's storage. `setup` is overidden to be an empty method on the proxy contract to prevent anyone besides the proxy contract from calling the implementation's `setup` on the proxy storage.

#### AxelarGateway.sol (477 sloc)

Implementation contract with shared functionality between the multisig
and singlesig contract versions.

#### AxelarGatewayMultisig.sol (393 sloc)

The implementation contract that accepts commands signed by Axelar network's validators (see `execute`).
Different commands require different sets of validators to sign (operators vs owners).
Operators correspond to a smaller subset of Axelar validators, whereas owners are chosen by stake and represent a larger subset.

#### AdminMultisigBase.sol (134 sloc)

Multisig governance contract. Upgrading the implementation is done via voting on the new implementation address from admin accounts.

#### ERC20.sol (86 sloc)

Base ERC20 contract used to deploy wrapped version of tokens on other chains.

#### ERC20Permit.sol (45 sloc)

Allow an account to issue a spending permit to another account.

#### MintableCappedERC20.sol (25 sloc)

Mintable ERC20 token contract with an optional capped total supply (when `capacity != 0`).
It also allows us the owner of the ERC20 contract to burn tokens for an account (`IERC20BurnFrom`).

#### BurnableMintableCappedERC20.sol (47 sloc)

The main token contract that's deployed for Axelar wrapped version of tokens on non-native chains.
This contract allows burning tokens from deposit addresses generated (`depositAddress`) by the Axelar network, where
users send their deposits. `salt` needed to generate the address is provided in a signed burn command
from the Axelar network validators.

#### TokenDeployer.sol (13 sloc)

When the Axelar network submits a signed command to deploy a token,
the token deployer contract is called to deploy the `BurnableMintableCappedERC20` token.
This is done to reduce the bytecode size of the gateway contract to allow deploying on EVM chains
with more restrictive gas limits.

#### DepositHandler.sol (22 sloc)

The contract deployed at the deposit addresses that allows burning/locking of the tokens
sent by the user. It prevents re-entrancy, and while it's methods are permisionless,
the gateway deploys the deposit handler and burns/locks in the same call (see `_burnToken`).

#### Context.sol (10 sloc)

Safe interface contract.

#### Ownable.sol (18 sloc)

Define ownership of a contract and modifiers for permissioned methods.

#### EternalStorage.sol (63 sloc)

Storage contract for the proxy.

#### ECDSA.sol (24 sloc)

Modified version of OpenZeppelin ECDSA signature authentication check.

# Areas to focus

We'd like wardens to particularly focus on the following:

1. General message passing: `sendToken`, `contractCallWithToken`, and `contractCall`.
2. Mints/burns for token transfers.
3. Authentication of commands: `execute` in `AxelarGatewayMultisig.sol`.
4. Transfer of owners/operators.

# Build

```bash
npm ci

npm run build

# Might need
# npm install mocha

npm run test  # Test with mocha
```

# References

Contracts repo: https://github.com/axelarnetwork/axelar-cgp-solidity

Network resources: https://docs.axelar.dev/resources

Token transfer app: https://satellite.axelar.network/

General Message Passing Usage: https://docs.axelar.dev/dev/gmp

Example token transfer flow: https://docs.axelar.dev/dev/cli/axl-to-evm

Deployed contracts: https://docs.axelar.dev/resources/mainnet

EVM module of the Axelar network that prepares commands for the gateway: https://github.com/axelarnetwork/axelar-core/blob/main/x/evm/keeper/msg_server.go
