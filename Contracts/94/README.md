# Foundation contest details

- \$71,250 USDC main award pot
- \$3,750 USDC gas and contract-size optimization award pot
  - [About size award pot / how-to submit](#gas-and-contract-size-optimization-award-pot)
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-02-foundation-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts February 24, 2022 00:00 UTC
- Ends March 2, 2022 23:59 UTC

# Overview

The Foundation marketplace is a contract which allows traders to buy and sell NFTs. Previously (the code on mainnet) supported just Auctions and Private Sales. This upcoming launch adds Buy Price and Offers.

- Auctions last for 24 hours. The NFT is escrowed in the market contract when it's listed. As soon as a bid is received the NFT cannot be withdrawn, guaranteeing that the sale will go through and the highest bidder gets the NFT. If a bid is placed in the final minutes of an auction, the countdown timer resets to 15-minutes remaining.
- Private Sales use a EIP-712 signature from the seller to authorize the trade to a specific buyer / price point. The buyer has 24 hours to accept the offer to buy the NFT before the signature expires.
- Buy Price allows the owner of an NFT to list it for sale at a specific price point. The NFT is escrowed in the market contract when the price is set. Once a collector buys at the price set, the NFT is instantly transferred and revenue is distributed.
- Offers allow collectors to make an offer for an NFT. The seller has 24-25 hours to accept the offer. During this time, the collector's funds are locked in the FETH ERC-20 contract - ensuring that an offer remains valid until its expiration. If a higher offer is made, the original user's FETH balance is unlocked and they can use those funds elsewhere (or withdraw the ETH).

All sales in the Foundation market will pay the creator 10% royalties on secondary sales. This is not specific to NFTs minted on Foundation, it should work for any NFT. If royalty information was not defined when the NFT was originally deployed, it may be added using the [Royalty Registry](https://royaltyregistry.xyz/) which will be respected by our market contract.

## Marketplace State Machine

Below is a diagram depicting the marketplace states and transitions for the various market tools.

<img width="5522" alt="MarketplaceStateMachine" src="https://user-images.githubusercontent.com/14855515/155433938-428f475f-2c6d-441f-9502-674d0f7953fc.png">

# Contracts

## Contract Documentation

- [FETH](/docs/FETH.md)
- [Market](/docs/FNDNFTMarket.md)

## Dependencies

- [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- [Royalty Registry](https://royaltyregistry.xyz/)

## Mixins

In order to maintain readability as our contracts grow in complexity, we separate responsibilities into different abstract contracts which we call 'mixins'. We try not to create too many interdependencies between mixins, shared logic may be defined in `NFTMarketCore` so mixins do not need to call each other directly.

## Contract UML

Below is a diagram depicting the relationships between various contracts.

<img width="2804" alt="UMLContractDiagram" src="https://user-images.githubusercontent.com/14855515/155433971-d048e5dc-86dc-49fd-8c0e-b930117867c5.png">

## FETH ERC-20 token

FETH is an [ERC-20 token](https://eips.ethereum.org/EIPS/eip-20) modeled after [WETH9](https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code). It has the added ability to lockup tokens for 24-25 hours - during this time they may not be transferred or withdrawn, except by our market contract which requested the lockup in the first place.

We strive to offer strong guarantees for both buyers and sellers, this is why a seller cannot back out of an auction once the first bid has been placed.

For making offers, this means once a collector has made an offer for an NFT - those funds must remain available for a period of time so the seller has a reasonable window to consider and accept it without worrying that the collector might just withdraw their funds, making the offer invalid.

We implement this feature in the FETH token contract, allowing funds to be locked up for 24-25 hours while the seller considers accepting the offer.

Once the offer expires, the FETH tokens become available again. Their `balanceOf` automatically increases at the time it expires and they can then transfer or withdraw those funds -- or they can use them to place another offer!

Since after lockups expire, FETH is just another wrapped ETH token contract - we allow using your available FETH balance with all the other market tools: place a bid with FETH, buy now with FETH, or buy from a private sale using FETH.

## Market Tool Interactions

Each of the market tools have dependencies and interactions with the others. The goal of these interactions is to do what's most likely intended or expected by the user -- and avoid leaving either the buyer or seller in an awkward state. For instance:

- In progress auctions must go to the highest bidder. This means that a buy price is not valid, it cannot be accepted. And since both offers and auctions last for 24 hours, the offer cannot be accepted so we should free those FETH tokens for the collector to use elsewhere.
- Auto-buy: If you make an offer above the current buy now price, process the purchase immediately.
- Auto-accept-offer: Similarly if you set a buy price lower than the highest offer, accept that offer instead.

It's easy to reach 100% code coverage, but much harder to know all these interactions work the way users will expect them too. Feedback along these lines is in scope for this contest.

## Upgrades

Our market contract uses an upgradeable proxy allowing us to add more features overtime. For an overview of the upgrade pattern, refer to the [OpenZeppelin documentation](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable).

This release should be compatible with our existing contract, deployed on mainnet at [0xcDA72070E455bb31C7690a170224Ce43623d0B6f](https://etherscan.io/address/0xcDA72070E455bb31C7690a170224Ce43623d0B6f) (with the current implementation at [0x8a8F22Aa06F47Fd453202eb1bd747a073f84bb4B](https://etherscan.io/address/0x8a8f22aa06f47fd453202eb1bd747a073f84bb4b#code)). Any issues discovered which would break the experience for our current users is in-scope for this contest.

## Sizes

| Contract Name                 | Source Lines of Code | Purpose                                                                                                                                                |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FNDNFTMarket**              | 61                   | The main / top-level contract for all market tools on Foundation.                                                                                      |
| Constants                     | 9                    | Shared constant values used by various mixins.                                                                                                         |
| FoundationTreasuryNode        | 35                   | A wrapper for communicating with the treasury contract which collects Foundation fees and defines the admin & operator roles.                          |
| NFTMarketCore                 | 49                   | A base class for the market to define functions that other mixins may implement or extend.                                                             |
| NFTMarketCreators             | 178                  | Used to lookup the royalty payout details for an NFT.                                                                                                  |
| SendValueWithFallbackWithdraw | 38                   | Used to transfer ETH and if it fails or runs out of gas, stores the payment in escrow for later withdrawal.                                            |
| NFTMarketFees                 | 103                  | Distributes revenue from sales.                                                                                                                        |
| NFTMarketAuction              | 14                   | A base class for reserve auctions, leaving room in case other auction mechanics are added in the future.                                               |
| NFTMarketReserveAuction       | 306                  | Allows NFT owners to list their NFT for sale in a 24-hour auction.                                                                                     |
| NFTMarketPrivateSale          | 95                   | Allows NFT owners to offer their NFT for sale to a specific buyer.                                                                                     |
| NFTMarketBuyPrice             | 151                  | Allows NFT owners to list their NFT for sale at a specific price point.                                                                                |
| NFTMarketOffer                | 156                  | Allows collectors to make an offer for an NFT.                                                                                                         |
| ERC165Checker                 | 42                   | An extension on the OZ implementation, allowing for more efficient ERC-165 interface checks.                                                           |
| AccountMigrationLibrary       | 43                   | A library used to verify migration authorization signatures from the original user's account.                                                          |
| **FETH**                      | 343                  | An ERC-20 token similar to WETH but with the ability to lockup funds for 24-25 hours, guaranteeing that an offer will remain available to be accepted. |
| LockedBalance                 | 66                   | A library used in order to store FETH lockups in a gas efficient manner.                                                                               |
| **Total**                     | 1689                 |

# Tests

Run:

```
yarn
yarn build
yarn test
```

The tests in this repo are not our full test suite. We have simplified what was included here to clearly demonstrate core features and interactions, they do not attempt to be complete code coverage.

# Scope

## Out of scope

- FoundationTreasury.sol and its dependencies not used elsewhere:
  - AdminRole.sol
  - CollateralManagement.sol
  - OperatorRole.sol
  - WithdrawFromEscrow.sol
- mocks/\*
- External libraries:
  - `@openzeppelin/*`
  - `@manifoldxyz/*`

Any issues or improvements to how we integrate with the contracts above is in scope.

## Known issues

These are known issues or areas for improvement that are out of scope from the contest:

- NFT contracts which implement one of the royalty APIs but returns data in a different format than expected may fail and this could potentially cause the NFT to be stuck in escrow.
  - We plan on addressing this in the future and since our market contract is upgradeable, no NFT will be stuck in the contract forever.
- NFT contracts without one of the currently support royalty APIs or that exhaust our gas limits will not pay any creator royalties.
  - Additional revenue will go to the owner/seller instead.
  - Impact NFTs could register an override with the royalty registry to work around this limitation.
- There is room to optimize the storage for auctions, significantly reducing gas costs.
  - This may be done in the future, but for now it will remain as is in order to ease upgrade compatibility.

## Gas and contract-size optimization award pot

Transactions on Ethereum are pretty expensive, so we are interested in optimizations where possible.

- Optimizations must be >= 100 gas saved to be eligible for a reward.
- No features / functionality should be lost.
- You can check gas costs by running `yarn test`

Contract bytecode must be <= 24.576 KB in order to deploy to the Ethereum network. Our market contract currently sits at 23.877 KB. We need help making room for our next set of features!

- Optimizations must be >= 0.1 KB to be eligible for a reward.
  - Only the FNDNFTMarket contract is eligible (incl mixins of course, FETH is not included since we have plenty of space).
- They should not cause gas costs to go up for users.
- No features / functionality should be lost.
- You can check contract size by running `yarn size-contracts`

### **How-to submit**

Please submit both gas optimizations and contract size optimizations in a single report, using the **`Gas optimizations`** risk rating on the [C4 submission form](https://code4rena.com/contests/2022-02-foundation-contest/submit). Contract size recommendations may be grouped under a separate heading within that report.
