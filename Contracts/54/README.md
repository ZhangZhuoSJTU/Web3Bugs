# Unlock Protocol contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-11-unlock-protocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts November 18, 2021 00:00 UTC
- Ends November 24, 2021 23:59 UTC

## Overview

Unlock is a protocol for memberships that lets creators of all kinds deploy a "membership contract" (we call that a Lock) and that lets them then sell memberships (keys, implemented as NFT).

[More high level details can be found there](https://docs.unlock-protocol.com/).

You can use the [Unlock Dashboard](https://app.unlock-protocol.com/dashboard) to deploy a lock on Rinkeby and then purchase a key using our "Demo". [The following video shows the way to achieve this](https://share.getcloudapp.com/4guPNlvW).

## Contracts:

* [Unlock.sol](https://github.com/unlock-protocol/unlock/blob/master/smart-contracts/contracts/Unlock.sol) : a factory contract that deploys all locks. It is also called back by the lock on key purchases to mint/distribute new UDT tokens. This contract is deployed once on each network currently supported (Mainnet, xDAI, Polygon, BSC). It is upgradable and currently 'owned' by a Gnosis multisig but will eventually be transfered to the DAO.

* [PublicLock](https://github.com/unlock-protocol/unlock/blob/master/smart-contracts/contracts/PublicLock.sol): the actual "membership" contract that implements ERC721 and a few others. It is deployed multiple times by creators.

* [UnlockDiscountTokenV2](https://github.com/unlock-protocol/unlock/blob/master/smart-contracts/contracts/UnlockDiscountTokenV2.sol): the governance token contract (UDT). The only minter is the Unlock contract.

[Smart contract docs are available on this page](https://docs.unlock-protocol.com/developers/smart-contracts).

[Governance docs are available on this page](https://docs.unlock-protocol.com/governance/the-unlock-token).

Note: the code being reviewed has not been deployed yet, even though it is an incremental upgrade on the existing deployed code. Similarly, the documentation reflects the current implementation, not the code being reviewed. You can find below the most significant change:

## Tests

You can run test in the smart-contracts repo with `yarn run test` (make sure you run `yarn install` first to install all dependencies).

If you want to run the front-end applications, please check instruction [in the main Unlock repo](https://github.com/unlock-protocol/unlock).

### Upgradable locks

The biggest change we introduced to the smart contract and that we hope to deploy in the next few weeks is to enable upgrades on the PublicLock smart contracts.
We want these locks to be upgradable when new versions of the protocol are released, but only by their "Lock Managers" ([See permission](https://docs.unlock-protocol.com/developers/smart-contracts/lock-api/access-control)).

The approach we took is to deploy a Proxy Admin as part of the Unlock.sol contract. We updated the `createLock` to deploy a lock proxy instead of the lock directly. We also introduced an `upgradeLock` function that can then be trigger by one of the lock's lock managers to update the implementation.

To support these uprgades, the Unlock contract will now keep a list of implementation, as well the corresponding version numbers as we only support incremental upgrades.

