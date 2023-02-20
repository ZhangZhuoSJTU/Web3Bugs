# xdefi-distribution

## Description
This contract provides a mechanisms for users to lock XDEFI, resulting in non-fungible locked positions, since each position is only un-lockable in its entirety after a certain time from locking. Locked positions have a right to withdraw at least the respective amount of XDEFI deposited, as well as a portion of XDEFI that was airdropped to this contract, and thus dispersed to all locked positions. This portion is based on the relative portion of locked XDEFI in comparison to all locked XDEFI, and the bonus multiplier of the locked position, which is assigned at lock-time based on the lock duration. Further, the locked and unlocked positions exist as NFTs with a score, in which several can be merged/burned to create new NFTs of a larger score.

## Features and Functionality
- Users can lock in an amount of XDEFI for a duration and cannot unlock/withdraw during the specified duration
- Lock durations and their respective bonus multiplier are definable by the admin, and can be changed. Even 0 seconds can be enabled. "No bonus" is effectively a bonus multiplier of 1, which still receives a "normal" share of future distributed rewards.
- User can lock in any amount of XDEFI, but not 0.
- The lockup becomes a “locked position”, which is an NFT (similar to Uniswap v3's liquidity position NFTs, but simpler).
- The "locked position" is transferable as a NFT during lockup and after it is unlocked/withdrawn.
- After a locked position's lockup time expires, the owner of the NFT can re-lock the amount into a new stake position, or withdraw it, or some combination, in one tx.
- Rewards are accrued while locked up, with a bonus multiplier based on the lockup time.
- Accruing of rewards/revenue with the bonus multiplier persists after the lockup time expires. This is fine since the goal is to reward the initial commitment. Further, one would be better off re-locking their withdrawable token, to compound.
- Upon locking, the NFT locked position is given a “score”, which is some function of amount and lockup time (i.e. `amount * duration`).
- The NFT's score is embedded in the `tokenId`, so the chain enforces it (first/leftmost 128 bits is the score, last/rightmost 128 bits is a sequential identifier, for uniqueness).
- The NFT points to some off-chain server that will serve the correct metadata given the NFTs points (i.e. `tokenId`). This is a stateless process off-chain.
- Once the NFT position has been unlocked and the XDEFI withdrawn, the NFT still exists simply as a transferable loyalty NFT, with its same score, but without any withdrawable XDEFI.
- Users can combine several of these amount-less loyalty NFTs into one, where the resulting NFT’s points is the sum of those burned to produce it.
- Contract supports Permit, which avoids the need to do ERC20 approvals for XDEFI locking.

## Contracts

### XDEFIDistribution

This contract contains the standalone logic for locking, unlocking, re-locking, batched unlocking, batched re-locking, and merging, as well as the ERC721Enumerable functionality.

### XDEFIDistributionHelper

This contract is a stateless helper for read-only functionality, intended to help reduce smart contact queries by front-ends/clients, currently supporting:
- `getAllTokensForAccount`, which returns an array of all tokenIds owned by an account
- `getAllLockedPositionsForAccount`, which returns:
    - an array of all tokenIds owned by an account that are still locked
    - an array of respective locked position info for each tokenId
    - an array of respective withdrawable amounts for each tokenId

## Testing and deployment

Setup with `npm install` or `npm ci`.

Compile with `npm run compile`.

Test with `npm run test`.

Coverage with `npm run coverage`.

Ensure a `./secrets.json` exists with:
```json
{
    "ropsten": {
        "mnemonic": "some mnemonic",
        "xdefi": "address of XDEFI token",
        "rpc": "HTTPS RPC URL",
        "baseURI": "Base URI for NFTs",
        "zeroDurationPointBase": "0"
    },
    "rinkeby": {...},
    "mainnet": {...},
    "ganache": {...},
    "some-other-network": {...}
}
```

Note: `zeroDurationPointBase` is the amount of points a position will be awarded for "locking in" for a 0 duration.

Deploy with `npm run deploy:networkName`, where `networkName` is the name of the network (i.e. `ropsten`, `mainnet`, etc).

Run sample backend NFT server with `npm run server`.
