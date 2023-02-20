# XDEFI contest details
- $22,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-xdefi-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 4th, 2022 00:00 UTC
- Ends January 6th, 2022 23:59 UTC

# Audit Scope

This scope of this audit includes the following repo, all with corresponding release tags:

- [XDeFi-tech/xdefi-distribution](https://github.com/XDeFi-tech/xdefi-distribution/releases/tag/v1.0.0-beta.0)

There are 2 contracts here:
- `XDEFIDistribution` is the main and only contract that is stateful, and extends openzeppelin's `ERC721Enumerable`, and adds custom "funds distribution" functionality, similar to an [ERC2222](https://github.com/ethereum/EIPs/issues/2222) [implementation](https://github.com/atpar/funds-distribution-token/blob/master/contracts/FundsDistributionToken.sol), but as NFT positions rather than ERC20 positions. You can read more in the `XDeFi-tech/xdefi-distribution` readme, or ask questions in the C4 Discord.
- `XDEFIDistributionHelper` is a low-risk, stateless, helper smart contract intended to be used by front-ends/clients to batch query the `XDEFIDistribution` contract instead of having to make multiple web3 calls.

## Focus Areas

### Funds Distribution

Ensure that distributution of additional funds sent to the `XDEFIDistribution` contract an recognized and accurately distributed via `updateDistribution`, so that they are withdrawable by position holders when they eventually unlock. Rounding errors (lack of precision) are expected, but should remain insignificant. However, it is important that new locking of XDEFI results in positions that are only eligible for portions of future rewards, and do not result in the "stealing" of past rewards from existing locked position holders. Similarly, the contract should never have less XDEFI that it needs to support all withdrawals/unlocks (i.e. sum of all `withdrawableOf` is less than or equal to the XEDFI balance of the contract itself).

### Scored NFTs

A position should always remain a valid NFT, even after it has been unlocked/withdrawn. The only difference between a locked and unlocked position is that:
- locked positions cannot be merged
- unlocked positions cannot be unlocked, and thus should not be eligible for any distributions of XDEFI, or and withdrawable amount of XDEFI

Scores are determined by the contract and merging should not result in the loss or creation of additional points.

### Decentralization

It should not be possible for anyone, even for the contract owner, to affect the current withdrawable amount of any locked position (within acceptable rounding), or prevent it from being unlocked at all when the position owner expected it to be un-lockable. For example, `setLockPeriods` is only able to change the validity of lock times of new locked positions, but existing locked positions remain unaffected. Any account should be able to send XDEFI token to the `XDEFIDistribution` contract and have it distributed to existing locked positions via `updateDistribution`.

## Assumptions and Issue Validity

- `XDEFIDistributionHelper` gas optimizations are not valid since the contract is not intended to be used in state-changing calls (i.e. calls where an on-chain transaction occurs resulting in tx fees)
- funds distribution accounting via the `_pointsPerUnit` and `pointsCorrection` is expected to result in minute inaccuracies where positions are allowed to withdraw slightly less than "they should". An issue of imprecision or rounding error is only valid if it results in the inability for a position to be unlocked/withdrawn, or a user getting more than expected (i.e. another position's share).
- tokenIds are intended to exist beyond their position's unlocking (i.e. there is no burning of NFTs upon position unlocking)
- It is assumed that the front-end/client-side dapp will be aware of valid locking durations (i.e. filtering events or hardcoded) so a mechanism to fetch thew array of valid locking durations is not necessary
- The contract handles the maximum amount of XDEFI in existence, which is 240,000,000 * 1,000,000,000,000,000,000 (i.e. 240k * 1e18), a max expiry of 50 years, and a max reward multiplier of 2.55x
