# ENS contest details
- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-07-ens-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts July 12, 2022 20:00 UTC
- Ends July 19, 2022 20:00 UTC

# About ENS

ENS is a decentralised naming service built on top of Ethereum, and designed to resolve a wide array of resources including blockchain addresses, decentralised content, and user profile information.

Developer documentation can be found [here](https://docs.ens.domains/).

Information on existing ENS deployments can be found [here](https://docs.ens.domains/ens-deployments).

# Developer guide

## Setup

```
git clone https://github.com/code-423n4/2022-07-ens
cd 2022-07-ens
yarn
```

## Running Tests

```
yarn test
```

# Contracts
**Note: Not all contracts in this repository are in-scope for this audit! We have included contracts from the original ens-contracts repo that are dependencies of in-scope contracts here for the convenience of auditors. Only the contracts listed below are in-scope.**

This audit is intended to cover several new and upgraded components of the ENS system:
 - The new Name Wrapper contract, which permits wrapping ENS names to provide significant additional functionality, including easy trustless subdomain issuance.
 - A rewritten DNSSEC oracle, which facilitates trustless onchain verification of DNSSEC proofs of DNS records.
 - Upgrades to the ETH registrar controller and reverse registrar to add support for the wrapper, as well as other quality-of-life improvements.

## contracts/dnssec-oracle
### [BytesUtils.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/BytesUtils.sol)
**SLOC**: 164

Contains assorted utility functions for manipulating byte strings.

### [DNSSECImpl.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/DNSSECImpl.sol)
**SLOC**: 183

An implementation of a DNSSEC client as per RFC4034 & RFC4035. `verifyRRSet` should return the RRData for the last record in the array of signed RRSets passed in, iff the set of records passes DNSSEC validation from the root. If validation fails, it should revert.

Dependencies:
 - Owned.sol
 - BytesUtils.sol
 - RRUtils.sol
 - @ensdomains/buffer/contracts/Buffer.sol

### [RRUtils.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/RRUtils.sol)
**SLOC**: 215

Utility functions for reading DNS RRSets.

Dependencies:
 - BytesUtils.sol
 - @ensdomains/buffer/contracts/Buffer.sol

### [SHA1.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/SHA1.sol)
**SLOC**: 82

A solidity/yul implementation of SHA1.

### [Owned.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/Owned.sol)
**SLOC**: 21

A simple ownable/owned interface.

### [DNSSEC.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/DNSSEC.sol)
**SLOC**: 11

A public interface for `DNSSECImpl.sol`.

## [algorithms/Algorithm.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/algorithms/Algorithm.sol)
**SLOC**: 3

Public interface for DNSSEC (public key) algorithim implementations.

## [digests/Digests.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/dnssec-oracle/digests/Digest.sol)
**SLOC**: 3

Public interface for DNSSEC digest (hash function) implementations.

## contracts/ethregistrar
### [ETHRegistrarController.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/ethregistrar/ETHRegistrarController.sol)
**SLOC**: 240

The ETHRegistrarController governs how ENS names are registered and renewed. This contract has been modified since the deployed version to add:
 - Support for the Name Wrapper.
 - Support for setting arbitary records at registration time.
 - Support for setting the reverse record (primary ENS name) at registration time.

Dependencies:
 - BaseRegistrarImplementation.sol
 - StringUtils.sol
 - ../resolvers/Resolver.sol
 - ../registry/ReverseRegistrar.sol
 - ../wrapper/NameWrapper.sol
 - @openzeppelin/contracts/access/Ownable.sol
 - @openzeppelin/contracts/utils/introspection/IERC165.sol
 - @openzeppelin/contracts/utils/Address.sol

### [IETHRegistrarController.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/ethregistrar/IETHRegistrarController.sol)
**SLOC**: 4

Public interface for `ETHRegistrarController`.

### [StringUtils.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/ethregistrar/StringUtils.sol)
**SLOC**: 25

String manipulation functions used by `ETHRegistrarController.sol`.

### [IBaseRegistrar.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/ethregistrar/IBaseRegistrar.sol)
**SLOC**: 18

Interface for the `BaseRegistrarImplementation` (not in scope).

## contracts/registry
### [ReverseRegistrar.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/registry/ReverseRegistrar.sol)
**SLOC**: 112

Allows users to register and update reverse records (primary ENS names). This contract has been modified since the deployed version with a number of improvements:
 - Support for the NameWrapper.
 - Support for arbitrary resolver contracts.
 - Now emits an event that can be used to reconstruct reverse mappings offchain (eg, in a subgraph).
 - Supports owners of contracts setting primary names on their behalf.

Dependencies:`
 - ENS.sol
 - ../root/Controllable.sol
 - @openzeppelin/contracts/access/Ownable.sol

### [IReverseRegistrar.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/registry/IReverseRegistrar.sol)
**SLOC**: 3

Public interface for `ReverseRegistrar.sol`.

## contracts/wrapper
### [BytesUtil.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/BytesUtil.sol)
**SLOC**: 27

Contains assorted utility functions for manipulating byte strings.

### [ERC1155Fuse.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/ERC1155Fuse.sol)
**SLOC**: 279

An implementation of ERC1155 that only supports 1 token per token type, with the owner, fuse/flag information, and an expiration time all packed into a single storage slot for gas-efficiency. Should conform to ERC1155, with the addition of `ownerOf`.

Dependencies:
 - @openzeppelin/contracts/utils/introspection/ERC165.sol
 - @openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol
 - @openzeppelin/contracts/token/ERC1155/IERC1155.sol
 - @openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol
 - @openzeppelin/contracts/utils/Address.sol

### [NameWrapper.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/NameWrapper.sol)
**SLOC**: 657

A contract that wraps ENS names, providing additional functionality:
 - Makes all names at any level valid ERC1155 NFTs.
 - Stores name preimages (plaintext names) onchain in an efficient format so they can be processed if needed.
 - Allows name owners to permanently or temporarily revoke control over certain aspects of the name, to enable trustless use of ENS names.
 - Acts as a controller for the .eth registrar, so that names can be registered and wrapped in a single operation.
 - Implements ERC721 receiver functionality, so .eth 2LDs can be wrapped in a single transfer operation.

The primary reason for this wrapper is the 'fuse' functionality for revoking permissions over names; this is intended to support applications such as trustless subdomain issuance, and trustless name resolution. The intended security/permission model is as follows:

 1. Each name has 'fuses' and an 'expiration'. Fuses are a bitmask, and a fuse is burned when it is set to 1.
 2. Fuses cannot be set ('burned') unless the expiration timestamp is in the future.
 3. Fuses that can be burned are `CANNOT_UNWRAP`, `CANNOT_BURN_FUSES`, `CANNOT_TRANSFER`, `CANNOT_SET_RESOLVER`, `CANNOT_SET_TTL`, `CANNOT_CREATE_SUBDOMAIN`, and `PARENT_CANNOT_CONTROL`.
 4. When the expiration timestamp passes, fuses are automatically cleared.
 5. Once a fuse is burned, it cannot be unburned until the expiration timestamp is reached.
 6. While the expiration timestamp is in the future, and the `CANNOT_UNWRAP` fuse is burned, the expiration timestamp can only ever be increased, not decreased.
 7. A .eth 2LD's (eg, foo.eth) expiration timestamp cannot be greater than the timestamp at which the name expires in the .eth registrar.
 8. For any other domain, its expiration timestamp cannot be greater than its parents' timestamp.
 9. A .eth 2LD's expiration timestamp can only be increased by the owner of the name, or an authorised caller.
 10. For any other domain, the expiration timestamp can only be increased by the owner of the parent name, or an authorised caller.
 12. Unless `CANNOT_UNWRAP` is burned, the only fuse that can be burned is `PARENT_CANNOT_CONTROL`.
 11. Unless `CANNOT_BURN_FUSES` is burned, the owner of a name can burn any fuse except `PARENT_CANNOT_CONTROL`.
 12. Unless a subdomain's `PARENT_CANNOT_CONTROL` fuse is burned, the owner of the parent name can burn any fuse on that subdomain, including `PARENT_CANNOT_CONTROL`.
 13. There should be no sequence of operations that can bypass the fuse checks on a name before the expiration timestamp.
 14. Calling `getData` on a name and checking that a. The expiration timestamp is in the future, and b. The required fuse is burned, should be sufficient to establish that that operation is not possible on that name through any sequence of operations prior to the expiration timestamp.

 Dependencies:
 - ERC1155Fuse.sol
 - Controllable.sol
 - BytesUtil.sol
 - ../registry/ENS.sol
 - ../ethregistrar/IBaseRegistrar.sol
 - @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol
 - @openzeppelin/contracts/access/Ownable.sol

### [INameWrapper.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/INameWrapper.sol)
**SLOC**: 24

Public interface for `NameWrapper.sol`.

### [Controllable.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/Controllable.sol)
**SLOC**: 14

Mixin for a contract that can have controllers - other accounts that have access to privileged functions.

### [IMetadataService.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/IMetadataService.sol)
**SLOC**: 3

Interface for a metadata service - a contract that returns token metadata for a wrapped token.

*** [INameWrapperUpgrade.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/wrapper/INameWrapperUpgrade.sol)
**SLOC**: 3

Interface for an upgrade target for the name wrapper - a new version of the wrapper.

## contracts/registry
### [ENS.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/registry/ENS.sol)
**SLOC**: 12

Interface for the ENS registry contract.

## contracts/resolvers
### [Resolver.sol](https://github.com/code-423n4/2022-07-ens/tree/main/contracts/resolvers/Resolver.sol)
**SLOC**: 29

Generic interface for ENS resolver contracts.
