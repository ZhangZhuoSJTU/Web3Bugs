# FNDNFTMarket

> A market for NFTs on Foundation.

The Foundation marketplace is a contract which allows traders to buy and sell NFTs. It supports buying and selling via auctions, private sales, buy price, and offers.

_All sales in the Foundation market will pay the creator 10% royalties on secondary sales. This is not specific to NFTs minted on Foundation, it should work for any NFT. If royalty information was not defined when the NFT was originally deployed, it may be added using the [Royalty Registry](https://royaltyregistry.xyz/) which will be respected by our market contract._

## Methods

### acceptOffer

```solidity
function acceptOffer(address nftContract, uint256 tokenId, address offerFrom, uint256 minAmount) external nonpayable
```

Accept the highest offer for an NFT.

_The offer must not be expired and the NFT owned + approved by the seller or available in the market contract&#39;s escrow._

#### Parameters

| Name        | Type    | Description                                                                                                                                                                                                                                                          |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nftContract | address | The address of the NFT contract.                                                                                                                                                                                                                                     |
| tokenId     | uint256 | The id of the NFT.                                                                                                                                                                                                                                                   |
| offerFrom   | address | The address of the collector that you wish to sell to. If the current highest offer is not from this user, the transaction will revert. This could happen if a last minute offer was made by another collector, and would require the seller to try accepting again. |
| minAmount   | uint256 | The minimum value of the highest offer for it to be accepted. If the value is less than this amount, the transaction will revert. This could happen if the original offer expires and is replaced with a smaller offer.                                              |

### adminAccountMigration

```solidity
function adminAccountMigration(uint256[] listedAuctionIds, address originalAddress, address payable newAddress, bytes signature) external nonpayable
```

Allows an NFT owner and Foundation to work together in order to update the seller for auctions they have listed to a new account.

_This will gracefully skip any auctions that have already been finalized._

#### Parameters

| Name             | Type            | Description                                                                                                                   |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| listedAuctionIds | uint256[]       | The ids of the auctions to update.                                                                                            |
| originalAddress  | address         | The original address of the seller of these auctions.                                                                         |
| newAddress       | address payable | The new address for the seller of these auctions.                                                                             |
| signature        | bytes           | Message `I authorize Foundation to migrate my account to ${newAccount.address.toLowerCase()}` signed by the original account. |

### adminCancelOffers

```solidity
function adminCancelOffers(address[] nftContracts, uint256[] tokenIds, string reason) external nonpayable
```

Allows Foundation to cancel offers. This will unlock the funds in the FETH ERC-20 contract for the highest offer and prevent the offer from being accepted.

_This should only be used for extreme cases such as DMCA takedown requests._

#### Parameters

| Name         | Type      | Description                                                                               |
| ------------ | --------- | ----------------------------------------------------------------------------------------- |
| nftContracts | address[] | The addresses of the NFT contracts to cancel. This must be the same length as `tokenIds`. |
| tokenIds     | uint256[] | The ids of the NFTs to cancel. This must be the same length as `nftContracts`.            |
| reason       | string    | The reason for the cancellation (a required field).                                       |

### adminCancelReserveAuction

```solidity
function adminCancelReserveAuction(uint256 auctionId, string reason) external nonpayable
```

Allows Foundation to cancel an auction, refunding the bidder and returning the NFT to the seller (if not active buy price set). This should only be used for extreme cases such as DMCA takedown requests.

#### Parameters

| Name      | Type    | Description                                         |
| --------- | ------- | --------------------------------------------------- |
| auctionId | uint256 | The id of the auction to cancel.                    |
| reason    | string  | The reason for the cancellation (a required field). |

### buy

```solidity
function buy(address nftContract, uint256 tokenId, uint256 maxPrice) external payable
```

Buy the NFT at the set buy price. `msg.value` must be &lt;= `maxPrice` and any delta will be taken from the account&#39;s available FETH balance.

_`maxPrice` protects the buyer in case a the price is increased but allows the transaction to continue when the price is reduced (and any surplus funds provided are refunded)._

#### Parameters

| Name        | Type    | Description                           |
| ----------- | ------- | ------------------------------------- |
| nftContract | address | The address of the NFT contract.      |
| tokenId     | uint256 | The id of the NFT.                    |
| maxPrice    | uint256 | The maximum price to pay for the NFT. |

### buyFromPrivateSale

```solidity
function buyFromPrivateSale(contract IERC721 nftContract, uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable
```

Buy an NFT from a private sale.

_The seller signs a message approving the sale and then the buyer calls this function with the `msg.value` equal to the agreed upon price._

#### Parameters

| Name        | Type             | Description                                           |
| ----------- | ---------------- | ----------------------------------------------------- |
| nftContract | contract IERC721 | The address of the NFT contract.                      |
| tokenId     | uint256          | The ID of the NFT.                                    |
| deadline    | uint256          | The timestamp at which the offer to sell will expire. |
| v           | uint8            | The v value of the EIP-712 signature.                 |
| r           | bytes32          | The r value of the EIP-712 signature.                 |
| s           | bytes32          | The s value of the EIP-712 signature.                 |

### buyFromPrivateSaleFor

```solidity
function buyFromPrivateSaleFor(contract IERC721 nftContract, uint256 tokenId, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable
```

Buy an NFT from a private sale.

_The seller signs a message approving the sale and then the buyer calls this function with the `amount` equal to the agreed upon price.`amount` - `msg.value` is withdrawn from the bidder&#39;s FETH balance._

#### Parameters

| Name        | Type             | Description                                                                                             |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| nftContract | contract IERC721 | The address of the NFT contract.                                                                        |
| tokenId     | uint256          | The ID of the NFT.                                                                                      |
| amount      | uint256          | The amount to buy for, if this is more than `msg.value` funds will be withdrawn from your FETH balance. |
| deadline    | uint256          | The timestamp at which the offer to sell will expire.                                                   |
| v           | uint8            | The v value of the EIP-712 signature.                                                                   |
| r           | bytes32          | The r value of the EIP-712 signature.                                                                   |
| s           | bytes32          | The s value of the EIP-712 signature.                                                                   |

### cancelBuyPrice

```solidity
function cancelBuyPrice(address nftContract, uint256 tokenId) external nonpayable
```

Removes the buy price set for an NFT.

_The NFT is transferred back to the owner unless it&#39;s still escrowed for another market tool, e.g. listed for sale in an auction._

#### Parameters

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| nftContract | address | The address of the NFT contract. |
| tokenId     | uint256 | The id of the NFT.               |

### cancelReserveAuction

```solidity
function cancelReserveAuction(uint256 auctionId) external nonpayable
```

If an auction has been created but has not yet received bids, it may be canceled by the seller.

_The NFT is transferred back to the owner unless there is still has a buy price set._

#### Parameters

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| auctionId | uint256 | The id of the auction to cancel. |

### createReserveAuction

```solidity
function createReserveAuction(address nftContract, uint256 tokenId, uint256 reservePrice) external nonpayable
```

Creates an auction for the given NFT. The NFT is held in escrow until the auction is finalized or canceled.

#### Parameters

| Name         | Type    | Description                                |
| ------------ | ------- | ------------------------------------------ |
| nftContract  | address | The address of the NFT contract.           |
| tokenId      | uint256 | The id of the NFT.                         |
| reservePrice | uint256 | The initial reserve price for the auction. |

### finalizeReserveAuction

```solidity
function finalizeReserveAuction(uint256 auctionId) external nonpayable
```

Once the countdown has expired for an auction, anyone can settle the auction. This will send the NFT to the highest bidder and distribute revenue for this sale.

#### Parameters

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| auctionId | uint256 | The id of the auction to settle. |

### getBuyPrice

```solidity
function getBuyPrice(address nftContract, uint256 tokenId) external view returns (address seller, uint256 price)
```

Returns the buy price details for an NFT if one is available.

_If no price is found, seller will be address(0) and price will be max uint256._

#### Parameters

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| nftContract | address | The address of the NFT contract. |
| tokenId     | uint256 | The id of the NFT.               |

#### Returns

| Name   | Type    | Description                                                                                                                    |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| seller | address | The address of the owner that listed a buy price for this NFT. Returns `address(0)` if there is no buy price set for this NFT. |
| price  | uint256 | The price of the NFT. Returns `0` if there is no buy price set for this NFT.                                                   |

### getFeesAndRecipients

```solidity
function getFeesAndRecipients(address nftContract, uint256 tokenId, uint256 price) external view returns (uint256 foundationFee, uint256 creatorRev, address payable[] creatorRecipients, uint256[] creatorShares, uint256 ownerRev, address payable owner)
```

Returns how funds will be distributed for a sale at the given price point.

#### Parameters

| Name        | Type    | Description                               |
| ----------- | ------- | ----------------------------------------- |
| nftContract | address | The address of the NFT contract.          |
| tokenId     | uint256 | The id of the NFT.                        |
| price       | uint256 | The sale price to calculate the fees for. |

#### Returns

| Name              | Type              | Description                                                                                                                                                                                                          |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| foundationFee     | uint256           | How much will be sent to the Foundation treasury.                                                                                                                                                                    |
| creatorRev        | uint256           | How much will be sent across all the `creatorRecipients` defined.                                                                                                                                                    |
| creatorRecipients | address payable[] | The addresses of the recipients to receive a portion of the creator fee.                                                                                                                                             |
| creatorShares     | uint256[]         | The percentage of the creator fee to be distributed to each `creatorRecipient`. If there is only one `creatorRecipient`, this may be an empty array. Otherwise `creatorShares.length` == `creatorRecipients.length`. |
| ownerRev          | uint256           | How much will be sent to the owner/seller of the NFT. If the NFT is being sold by the creator, this may be 0 and the full revenue will appear as `creatorRev`.                                                       |
| owner             | address payable   | The address of the owner of the NFT. If `ownerRev` is 0, this may be `address(0)`.                                                                                                                                   |

### getFethAddress

```solidity
function getFethAddress() external view returns (address fethAddress)
```

Gets the FETH contract used to escrow offer funds.

#### Returns

| Name        | Type    | Description                |
| ----------- | ------- | -------------------------- |
| fethAddress | address | The FETH contract address. |

### getFoundationTreasury

```solidity
function getFoundationTreasury() external view returns (address payable treasuryAddress)
```

Gets the Foundation treasury contract.

_This call is used in the royalty registry contract._

#### Returns

| Name            | Type            | Description                                      |
| --------------- | --------------- | ------------------------------------------------ |
| treasuryAddress | address payable | The address of the Foundation treasury contract. |

### getMinBidAmount

```solidity
function getMinBidAmount(uint256 auctionId) external view returns (uint256 minimum)
```

Returns the minimum amount a bidder must spend to participate in an auction. Bids must be greater than or equal to this value or they will revert.

#### Parameters

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| auctionId | uint256 | The id of the auction to check. |

#### Returns

| Name    | Type    | Description                                  |
| ------- | ------- | -------------------------------------------- |
| minimum | uint256 | The minimum amount for a bid to be accepted. |

### getMinOfferAmount

```solidity
function getMinOfferAmount(address nftContract, uint256 tokenId) external view returns (uint256 minimum)
```

Returns the minimum amount a collector must offer for this NFT in order for the offer to be valid.

_Offers for this NFT which are less than this value will revert. Once the previous offer has expired smaller offers can be made._

#### Parameters

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| nftContract | address | The address of the NFT contract. |
| tokenId     | uint256 | The id of the NFT.               |

#### Returns

| Name    | Type    | Description                                           |
| ------- | ------- | ----------------------------------------------------- |
| minimum | uint256 | The minimum amount that must be offered for this NFT. |

### getOffer

```solidity
function getOffer(address nftContract, uint256 tokenId) external view returns (address buyer, uint256 expiration, uint256 amount)
```

Returns details about the current highest offer for an NFT.

_Default values are returned if there is no offer or the offer has expired._

#### Parameters

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| nftContract | address | The address of the NFT contract. |
| tokenId     | uint256 | The id of the NFT.               |

#### Returns

| Name       | Type    | Description                                                                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| buyer      | address | The address of the buyer that made the current highest offer. Returns `address(0)` if there is no offer or the most recent offer has expired. |
| expiration | uint256 | The timestamp that the current highest offer expires. Returns `0` if there is no offer or the most recent offer has expired.                  |
| amount     | uint256 | The amount being offered for this NFT. Returns `0` if there is no offer or the most recent offer has expired.                                 |

### getPendingWithdrawal

```solidity
function getPendingWithdrawal(address user) external view returns (uint256 balance)
```

Returns how much funds are available for manual withdraw due to failed transfers.

#### Parameters

| Name | Type    | Description                                   |
| ---- | ------- | --------------------------------------------- |
| user | address | The account to check the escrowed balance of. |

#### Returns

| Name    | Type    | Description                                                                |
| ------- | ------- | -------------------------------------------------------------------------- |
| balance | uint256 | The amount of funds which are available for withdrawal for the given user. |

### getReserveAuction

```solidity
function getReserveAuction(uint256 auctionId) external view returns (struct NFTMarketReserveAuction.ReserveAuction auction)
```

Returns auction details for a given auctionId.

#### Parameters

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| auctionId | uint256 | The id of the auction to lookup. |

#### Returns

| Name    | Type                                   | Description          |
| ------- | -------------------------------------- | -------------------- |
| auction | NFTMarketReserveAuction.ReserveAuction | The auction details. |

### getReserveAuctionIdFor

```solidity
function getReserveAuctionIdFor(address nftContract, uint256 tokenId) external view returns (uint256 auctionId)
```

Returns the auctionId for a given NFT, or 0 if no auction is found.

_If an auction is canceled, it will not be returned. However the auction may be over and pending finalization._

#### Parameters

| Name        | Type    | Description                      |
| ----------- | ------- | -------------------------------- |
| nftContract | address | The address of the NFT contract. |
| tokenId     | uint256 | The id of the NFT.               |

#### Returns

| Name      | Type    | Description                                         |
| --------- | ------- | --------------------------------------------------- |
| auctionId | uint256 | The id of the auction, or 0 if no auction is found. |

### getRoyaltyRegistry

```solidity
function getRoyaltyRegistry() external view returns (address registry)
```

Returns the address of the registry allowing for royalty configuration overrides.

#### Returns

| Name     | Type    | Description                                   |
| -------- | ------- | --------------------------------------------- |
| registry | address | The address of the royalty registry contract. |

### initialize

```solidity
function initialize() external nonpayable
```

Called once to configure the contract after the initial proxy deployment.

_This farms the initialize call out to inherited contracts as needed to initialize mutable variables._

### makeOffer

```solidity
function makeOffer(address nftContract, uint256 tokenId, uint256 amount) external payable returns (uint256 expiration)
```

Make an offer for any NFT which is valid for 24-25 hours. The funds will be locked in the FETH token contract and become available once the offer is outbid or has expired.

_An offer may be made for an NFT before it is minted, although we generally not recommend you do that. If there is a buy price set at this price or lower, that will be accepted instead of making an offer. `msg.value` must be &lt;= `amount` and any delta will be taken from the account&#39;s available FETH balance._

#### Parameters

| Name        | Type    | Description                       |
| ----------- | ------- | --------------------------------- |
| nftContract | address | The address of the NFT contract.  |
| tokenId     | uint256 | The id of the NFT.                |
| amount      | uint256 | The amount to offer for this NFT. |

#### Returns

| Name       | Type    | Description                                                                                                                                                                                                                                                                                                               |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| expiration | uint256 | The timestamp for when this offer will expire. This is provided as a return value in case another contract would like to leverage this information, user&#39;s should refer to the expiration in the `OfferMade` event log. If the buy price is accepted instead, `0` is returned as the expiration since that&#39;s n/a. |

### placeBid

```solidity
function placeBid(uint256 auctionId) external payable
```

Place a bid in an auction. A bidder may place a bid which is at least the value defined by `getMinBidAmount`. If this is the first bid on the auction, the countdown will begin. If there is already an outstanding bid, the previous bidder will be refunded at this time and if the bid is placed in the final moments of the auction, the countdown may be extended.

#### Parameters

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| auctionId | uint256 | The id of the auction to bid on. |

### placeBidOf

```solidity
function placeBidOf(uint256 auctionId, uint256 amount) external payable
```

Place a bid in an auction. A bidder may place a bid which is at least the amount defined by `getMinBidAmount`. If this is the first bid on the auction, the countdown will begin. If there is already an outstanding bid, the previous bidder will be refunded at this time and if the bid is placed in the final moments of the auction, the countdown may be extended.

_`amount` - `msg.value` is withdrawn from the bidder&#39;s FETH balance._

#### Parameters

| Name      | Type    | Description                                                                                         |
| --------- | ------- | --------------------------------------------------------------------------------------------------- |
| auctionId | uint256 | The id of the auction to bid on.                                                                    |
| amount    | uint256 | The amount to bid, if this is more than `msg.value` funds will be withdrawn from your FETH balance. |

### setBuyPrice

```solidity
function setBuyPrice(address nftContract, uint256 tokenId, uint256 price) external nonpayable
```

Sets the buy price for an NFT and escrows it in the market contract.

_If there is an offer for this amount or higher, that will be accepted instead of setting a buy price._

#### Parameters

| Name        | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| nftContract | address | The address of the NFT contract.               |
| tokenId     | uint256 | The id of the NFT.                             |
| price       | uint256 | The price at which someone could buy this NFT. |

### updateReserveAuction

```solidity
function updateReserveAuction(uint256 auctionId, uint256 reservePrice) external nonpayable
```

If an auction has been created but has not yet received bids, the reservePrice may be changed by the seller.

#### Parameters

| Name         | Type    | Description                             |
| ------------ | ------- | --------------------------------------- |
| auctionId    | uint256 | The id of the auction to change.        |
| reservePrice | uint256 | The new reserve price for this auction. |

### withdraw

```solidity
function withdraw() external nonpayable
```

Allows a user to manually withdraw funds which originally failed to transfer to themselves.

### withdrawFor

```solidity
function withdrawFor(address payable user) external nonpayable
```

Allows anyone to manually trigger a withdrawal of funds which originally failed to transfer for a user.

#### Parameters

| Name | Type            | Description                                     |
| ---- | --------------- | ----------------------------------------------- |
| user | address payable | The account which has escrowed ETH to withdraw. |

## Events

### BuyPriceAccepted

```solidity
event BuyPriceAccepted(address indexed nftContract, uint256 indexed tokenId, address indexed seller, address buyer, uint256 f8nFee, uint256 creatorFee, uint256 ownerRev)
```

Emitted when an NFT is bought by accepting the buy price, indicating that the NFT has been transferred and revenue from the sale distributed.

_The total buy price that was accepted is `f8nFee` + `creatorFee` + `ownerRev`._

#### Parameters

| Name                  | Type    | Description                                                      |
| --------------------- | ------- | ---------------------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                                 |
| tokenId `indexed`     | uint256 | The id of the NFT.                                               |
| seller `indexed`      | address | The address of the seller which originally set the buy price.    |
| buyer                 | address | The address of the collector that purchased the NFT using `buy`. |
| f8nFee                | uint256 | The amount of ETH that was sent to Foundation for this sale.     |
| creatorFee            | uint256 | The amount of ETH that was sent to the creator for this sale.    |
| ownerRev              | uint256 | The amount of ETH that was sent to the owner for this sale.      |

### BuyPriceCanceled

```solidity
event BuyPriceCanceled(address indexed nftContract, uint256 indexed tokenId)
```

Emitted when the buy price is removed by the owner of an NFT.

_The NFT is transferred back to the owner unless it&#39;s still escrowed for another market tool, e.g. listed for sale in an auction._

#### Parameters

| Name                  | Type    | Description                      |
| --------------------- | ------- | -------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract. |
| tokenId `indexed`     | uint256 | The id of the NFT.               |

### BuyPriceInvalidated

```solidity
event BuyPriceInvalidated(address indexed nftContract, uint256 indexed tokenId)
```

Emitted when a buy price is invalidated due to other market activity.

_This occurs when the buy price is no longer eligible to be accepted, e.g. when a bid is placed in an auction for this NFT._

#### Parameters

| Name                  | Type    | Description                      |
| --------------------- | ------- | -------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract. |
| tokenId `indexed`     | uint256 | The id of the NFT.               |

### BuyPriceSet

```solidity
event BuyPriceSet(address indexed nftContract, uint256 indexed tokenId, address indexed seller, uint256 price)
```

Emitted when a buy price is set by the owner of an NFT.

_The NFT is transferred into the market contract for escrow unless it was already escrowed, e.g. for auction listing._

#### Parameters

| Name                  | Type    | Description                                           |
| --------------------- | ------- | ----------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                      |
| tokenId `indexed`     | uint256 | The id of the NFT.                                    |
| seller `indexed`      | address | The address of the NFT owner which set the buy price. |
| price                 | uint256 | The price of the NFT.                                 |

### OfferAccepted

```solidity
event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, address seller, uint256 f8nFee, uint256 creatorFee, uint256 ownerRev)
```

Emitted when an offer is accepted, indicating that the NFT has been transferred and revenue from the sale distributed.

_The accepted total offer amount is `f8nFee` + `creatorFee` + `ownerRev`._

#### Parameters

| Name                  | Type    | Description                                                          |
| --------------------- | ------- | -------------------------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                                     |
| tokenId `indexed`     | uint256 | The id of the NFT.                                                   |
| buyer `indexed`       | address | The address of the collector that made the offer which was accepted. |
| seller                | address | The address of the seller which accepted the offer.                  |
| f8nFee                | uint256 | The amount of ETH that was sent to Foundation for this sale.         |
| creatorFee            | uint256 | The amount of ETH that was sent to the creator for this sale.        |
| ownerRev              | uint256 | The amount of ETH that was sent to the owner for this sale.          |

### OfferCanceledByAdmin

```solidity
event OfferCanceledByAdmin(address indexed nftContract, uint256 indexed tokenId, string reason)
```

Emitted when an offer is canceled by a Foundation admin.

_This should only be used for extreme cases such as DMCA takedown requests._

#### Parameters

| Name                  | Type    | Description                                         |
| --------------------- | ------- | --------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                    |
| tokenId `indexed`     | uint256 | The id of the NFT.                                  |
| reason                | string  | The reason for the cancellation (a required field). |

### OfferInvalidated

```solidity
event OfferInvalidated(address indexed nftContract, uint256 indexed tokenId)
```

Emitted when an offer is invalidated due to other market activity. When this occurs, the collector which made the offer has their FETH balance unlocked and the funds are available to place other offers or to be withdrawn.

_This occurs when the offer is no longer eligible to be accepted, e.g. when a bid is placed in an auction for this NFT._

#### Parameters

| Name                  | Type    | Description                      |
| --------------------- | ------- | -------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract. |
| tokenId `indexed`     | uint256 | The id of the NFT.               |

### OfferMade

```solidity
event OfferMade(address indexed nftContract, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 expiration)
```

Emitted when an offer is made.

_The `amount` of the offer is locked in the FETH ERC-20 contract, guaranteeing that the funds remain available until the `expiration` date._

#### Parameters

| Name                  | Type    | Description                                                       |
| --------------------- | ------- | ----------------------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                                  |
| tokenId `indexed`     | uint256 | The id of the NFT.                                                |
| buyer `indexed`       | address | The address of the collector that made the offer to buy this NFT. |
| amount                | uint256 | The amount, in wei, of the offer.                                 |
| expiration            | uint256 | The expiration timestamp for the offer.                           |

### PrivateSaleFinalized

```solidity
event PrivateSaleFinalized(address indexed nftContract, uint256 indexed tokenId, address indexed seller, address buyer, uint256 f8nFee, uint256 creatorFee, uint256 ownerRev, uint256 deadline)
```

Emitted when an NFT is sold in a private sale.

_The total amount of this sale is `f8nFee` + `creatorFee` + `ownerRev`._

#### Parameters

| Name                  | Type    | Description                                                   |
| --------------------- | ------- | ------------------------------------------------------------- |
| nftContract `indexed` | address | The address of the NFT contract.                              |
| tokenId `indexed`     | uint256 | The ID of the NFT.                                            |
| seller `indexed`      | address | The address of the seller.                                    |
| buyer                 | address | The address of the buyer.                                     |
| f8nFee                | uint256 | The amount of ETH that was sent to Foundation for this sale.  |
| creatorFee            | uint256 | The amount of ETH that was sent to the creator for this sale. |
| ownerRev              | uint256 | The amount of ETH that was sent to the owner for this sale.   |
| deadline              | uint256 | When the private sale offer was set to expire.                |

### ReserveAuctionBidPlaced

```solidity
event ReserveAuctionBidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 endTime)
```

Emitted when a bid is placed.

#### Parameters

| Name                | Type    | Description                                                                        |
| ------------------- | ------- | ---------------------------------------------------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction this bid was for.                                            |
| bidder `indexed`    | address | The address of the bidder.                                                         |
| amount              | uint256 | The amount of the bid.                                                             |
| endTime             | uint256 | The new end time of the auction (which may have been set or extended by this bid). |

### ReserveAuctionCanceled

```solidity
event ReserveAuctionCanceled(uint256 indexed auctionId)
```

Emitted when an auction is cancelled.

_This is only possible if the auction has not received any bids._

#### Parameters

| Name                | Type    | Description                               |
| ------------------- | ------- | ----------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction that was cancelled. |

### ReserveAuctionCanceledByAdmin

```solidity
event ReserveAuctionCanceledByAdmin(uint256 indexed auctionId, string reason)
```

Emitted when an auction is canceled by a Foundation admin.

_When this occurs, the highest bidder (if there was a bid) is automatically refunded._

#### Parameters

| Name                | Type    | Description                               |
| ------------------- | ------- | ----------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction that was cancelled. |
| reason              | string  | The reason for the cancellation.          |

### ReserveAuctionCreated

```solidity
event ReserveAuctionCreated(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 duration, uint256 extensionDuration, uint256 reservePrice, uint256 auctionId)
```

Emitted when an NFT is listed for auction.

#### Parameters

| Name                  | Type    | Description                                                       |
| --------------------- | ------- | ----------------------------------------------------------------- |
| seller `indexed`      | address | The address of the seller.                                        |
| nftContract `indexed` | address | The address of the NFT contract.                                  |
| tokenId `indexed`     | uint256 | The id of the NFT.                                                |
| duration              | uint256 | The duration of the auction (always 24-hours).                    |
| extensionDuration     | uint256 | The duration of the auction extension window (always 15-minutes). |
| reservePrice          | uint256 | The reserve price to kick off the auction.                        |
| auctionId             | uint256 | The id of the auction that was created.                           |

### ReserveAuctionFinalized

```solidity
event ReserveAuctionFinalized(uint256 indexed auctionId, address indexed seller, address indexed bidder, uint256 f8nFee, uint256 creatorFee, uint256 ownerRev)
```

Emitted when an auction that has already ended is finalized, indicating that the NFT has been transferred and revenue from the sale distributed.

_The amount of the highest bid / final sale price for this auction is `f8nFee` + `creatorFee` + `ownerRev`._

#### Parameters

| Name                | Type    | Description                                                   |
| ------------------- | ------- | ------------------------------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction that was finalized.                     |
| seller `indexed`    | address | The address of the seller.                                    |
| bidder `indexed`    | address | The address of the highest bidder that won the NFT.           |
| f8nFee              | uint256 | The amount of ETH that was sent to Foundation for this sale.  |
| creatorFee          | uint256 | The amount of ETH that was sent to the creator for this sale. |
| ownerRev            | uint256 | The amount of ETH that was sent to the owner for this sale.   |

### ReserveAuctionInvalidated

```solidity
event ReserveAuctionInvalidated(uint256 indexed auctionId)
```

Emitted when an auction is invalidated due to other market activity.

_This occurs when the NFT is sold another way, such as with `buy` or `acceptOffer`._

#### Parameters

| Name                | Type    | Description                                 |
| ------------------- | ------- | ------------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction that was invalidated. |

### ReserveAuctionSellerMigrated

```solidity
event ReserveAuctionSellerMigrated(uint256 indexed auctionId, address indexed originalSellerAddress, address indexed newSellerAddress)
```

Emitted when the seller for an auction has been changed to a new account.

_Account migrations require approval from both the original account and Foundation._

#### Parameters

| Name                            | Type    | Description                                       |
| ------------------------------- | ------- | ------------------------------------------------- |
| auctionId `indexed`             | uint256 | The id of the auction that was updated.           |
| originalSellerAddress `indexed` | address | The original address of the auction&#39;s seller. |
| newSellerAddress `indexed`      | address | The new address for the auction&#39;s seller.     |

### ReserveAuctionUpdated

```solidity
event ReserveAuctionUpdated(uint256 indexed auctionId, uint256 reservePrice)
```

Emitted when the auction&#39;s reserve price is changed.

_This is only possible if the auction has not received any bids._

#### Parameters

| Name                | Type    | Description                             |
| ------------------- | ------- | --------------------------------------- |
| auctionId `indexed` | uint256 | The id of the auction that was updated. |
| reservePrice        | uint256 | The new reserve price for the auction.  |

### WithdrawPending

```solidity
event WithdrawPending(address indexed user, uint256 amount)
```

Emitted when an attempt to send ETH fails or runs out of gas and the value is stored in escrow instead.

#### Parameters

| Name           | Type    | Description                                                              |
| -------------- | ------- | ------------------------------------------------------------------------ |
| user `indexed` | address | The account which has escrowed ETH to withdraw.                          |
| amount         | uint256 | The amount of ETH which has been added to the user&#39;s escrow balance. |

### Withdrawal

```solidity
event Withdrawal(address indexed user, uint256 amount)
```

Emitted when escrowed funds are withdrawn.

#### Parameters

| Name           | Type    | Description                                 |
| -------------- | ------- | ------------------------------------------- |
| user `indexed` | address | The account which has withdrawn ETH.        |
| amount         | uint256 | The amount of ETH which has been withdrawn. |

## Errors

### AccountMigrationLibrary_Cannot_Migrate_Account_To_Itself

```solidity
error AccountMigrationLibrary_Cannot_Migrate_Account_To_Itself()
```

### AccountMigrationLibrary_Signature_Verification_Failed

```solidity
error AccountMigrationLibrary_Signature_Verification_Failed()
```

### FoundationTreasuryNode_Address_Is_Not_A_Contract

```solidity
error FoundationTreasuryNode_Address_Is_Not_A_Contract()
```

### FoundationTreasuryNode_Caller_Not_Admin

```solidity
error FoundationTreasuryNode_Caller_Not_Admin()
```

### FoundationTreasuryNode_Caller_Not_Operator

```solidity
error FoundationTreasuryNode_Caller_Not_Operator()
```

### NFTMarketBuyPrice_Cannot_Buy_At_Lower_Price

```solidity
error NFTMarketBuyPrice_Cannot_Buy_At_Lower_Price(uint256 buyPrice)
```

#### Parameters

| Name     | Type    | Description                             |
| -------- | ------- | --------------------------------------- |
| buyPrice | uint256 | The current buy price set for this NFT. |

### NFTMarketBuyPrice_Cannot_Buy_Unset_Price

```solidity
error NFTMarketBuyPrice_Cannot_Buy_Unset_Price()
```

### NFTMarketBuyPrice_Cannot_Cancel_Unset_Price

```solidity
error NFTMarketBuyPrice_Cannot_Cancel_Unset_Price()
```

### NFTMarketBuyPrice_Only_Owner_Can_Cancel_Price

```solidity
error NFTMarketBuyPrice_Only_Owner_Can_Cancel_Price(address owner)
```

#### Parameters

| Name  | Type    | Description                    |
| ----- | ------- | ------------------------------ |
| owner | address | The current owner of this NFT. |

### NFTMarketBuyPrice_Only_Owner_Can_Set_Price

```solidity
error NFTMarketBuyPrice_Only_Owner_Can_Set_Price(address owner)
```

#### Parameters

| Name  | Type    | Description                    |
| ----- | ------- | ------------------------------ |
| owner | address | The current owner of this NFT. |

### NFTMarketBuyPrice_Price_Too_High

```solidity
error NFTMarketBuyPrice_Price_Too_High()
```

### NFTMarketBuyPrice_Seller_Mismatch

```solidity
error NFTMarketBuyPrice_Seller_Mismatch(address seller)
```

#### Parameters

| Name   | Type    | Description                    |
| ------ | ------- | ------------------------------ |
| seller | address | The current owner of this NFT. |

### NFTMarketCore_FETH_Address_Is_Not_A_Contract

```solidity
error NFTMarketCore_FETH_Address_Is_Not_A_Contract()
```

### NFTMarketCore_Only_FETH_Can_Transfer_ETH

```solidity
error NFTMarketCore_Only_FETH_Can_Transfer_ETH()
```

### NFTMarketCreators_Address_Does_Not_Support_IRoyaltyRegistry

```solidity
error NFTMarketCreators_Address_Does_Not_Support_IRoyaltyRegistry()
```

### NFTMarketOffer_Cannot_Be_Accepted_While_In_Auction

```solidity
error NFTMarketOffer_Cannot_Be_Accepted_While_In_Auction()
```

### NFTMarketOffer_Offer_Below_Min_Amount

```solidity
error NFTMarketOffer_Offer_Below_Min_Amount(uint256 currentOfferAmount)
```

#### Parameters

| Name               | Type    | Description                                       |
| ------------------ | ------- | ------------------------------------------------- |
| currentOfferAmount | uint256 | The current highest offer available for this NFT. |

### NFTMarketOffer_Offer_Expired

```solidity
error NFTMarketOffer_Offer_Expired(uint256 expiry)
```

#### Parameters

| Name   | Type    | Description                              |
| ------ | ------- | ---------------------------------------- |
| expiry | uint256 | The time at which the offer had expired. |

### NFTMarketOffer_Offer_From_Does_Not_Match

```solidity
error NFTMarketOffer_Offer_From_Does_Not_Match(address currentOfferFrom)
```

#### Parameters

| Name             | Type    | Description                                                            |
| ---------------- | ------- | ---------------------------------------------------------------------- |
| currentOfferFrom | address | The address of the collector which has made the current highest offer. |

### NFTMarketOffer_Offer_Must_Be_At_Least_Min_Amount

```solidity
error NFTMarketOffer_Offer_Must_Be_At_Least_Min_Amount(uint256 minOfferAmount)
```

#### Parameters

| Name           | Type    | Description                                                             |
| -------------- | ------- | ----------------------------------------------------------------------- |
| minOfferAmount | uint256 | The minimum amount that must be offered in order for it to be accepted. |

### NFTMarketOffer_Reason_Required

```solidity
error NFTMarketOffer_Reason_Required()
```

### NFTMarketPrivateSale_Can_Be_Offered_For_24Hrs_Max

```solidity
error NFTMarketPrivateSale_Can_Be_Offered_For_24Hrs_Max()
```

### NFTMarketPrivateSale_Proxy_Address_Is_Not_A_Contract

```solidity
error NFTMarketPrivateSale_Proxy_Address_Is_Not_A_Contract()
```

### NFTMarketPrivateSale_Sale_Expired

```solidity
error NFTMarketPrivateSale_Sale_Expired()
```

### NFTMarketPrivateSale_Signature_Verification_Failed

```solidity
error NFTMarketPrivateSale_Signature_Verification_Failed()
```

### NFTMarketPrivateSale_Too_Much_Value_Provided

```solidity
error NFTMarketPrivateSale_Too_Much_Value_Provided()
```

### NFTMarketReserveAuction_Bid_Must_Be_At_Least_Min_Amount

```solidity
error NFTMarketReserveAuction_Bid_Must_Be_At_Least_Min_Amount(uint256 minAmount)
```

#### Parameters

| Name      | Type    | Description                                                         |
| --------- | ------- | ------------------------------------------------------------------- |
| minAmount | uint256 | The minimum amount that must be bid in order for it to be accepted. |

### NFTMarketReserveAuction_Cannot_Admin_Cancel_Without_Reason

```solidity
error NFTMarketReserveAuction_Cannot_Admin_Cancel_Without_Reason()
```

### NFTMarketReserveAuction_Cannot_Bid_Lower_Than_Reserve_Price

```solidity
error NFTMarketReserveAuction_Cannot_Bid_Lower_Than_Reserve_Price(uint256 reservePrice)
```

#### Parameters

| Name         | Type    | Description                |
| ------------ | ------- | -------------------------- |
| reservePrice | uint256 | The current reserve price. |

### NFTMarketReserveAuction_Cannot_Bid_On_Ended_Auction

```solidity
error NFTMarketReserveAuction_Cannot_Bid_On_Ended_Auction(uint256 endTime)
```

#### Parameters

| Name    | Type    | Description                                   |
| ------- | ------- | --------------------------------------------- |
| endTime | uint256 | The timestamp at which the auction had ended. |

### NFTMarketReserveAuction_Cannot_Bid_On_Nonexistent_Auction

```solidity
error NFTMarketReserveAuction_Cannot_Bid_On_Nonexistent_Auction()
```

### NFTMarketReserveAuction_Cannot_Cancel_Nonexistent_Auction

```solidity
error NFTMarketReserveAuction_Cannot_Cancel_Nonexistent_Auction()
```

### NFTMarketReserveAuction_Cannot_Finalize_Already_Settled_Auction

```solidity
error NFTMarketReserveAuction_Cannot_Finalize_Already_Settled_Auction()
```

### NFTMarketReserveAuction_Cannot_Finalize_Auction_In_Progress

```solidity
error NFTMarketReserveAuction_Cannot_Finalize_Auction_In_Progress(uint256 endTime)
```

#### Parameters

| Name    | Type    | Description                                  |
| ------- | ------- | -------------------------------------------- |
| endTime | uint256 | The timestamp at which the auction will end. |

### NFTMarketReserveAuction_Cannot_Migrate_Non_Matching_Seller

```solidity
error NFTMarketReserveAuction_Cannot_Migrate_Non_Matching_Seller(address seller)
```

#### Parameters

| Name   | Type    | Description                   |
| ------ | ------- | ----------------------------- |
| seller | address | The current owner of the NFT. |

### NFTMarketReserveAuction_Cannot_Rebid_Over_Outstanding_Bid

```solidity
error NFTMarketReserveAuction_Cannot_Rebid_Over_Outstanding_Bid()
```

### NFTMarketReserveAuction_Cannot_Update_Auction_In_Progress

```solidity
error NFTMarketReserveAuction_Cannot_Update_Auction_In_Progress()
```

### NFTMarketReserveAuction_Exceeds_Max_Duration

```solidity
error NFTMarketReserveAuction_Exceeds_Max_Duration(uint256 maxDuration)
```

#### Parameters

| Name        | Type    | Description                                                          |
| ----------- | ------- | -------------------------------------------------------------------- |
| maxDuration | uint256 | The maximum configuration for a duration of the auction, in seconds. |

### NFTMarketReserveAuction_Less_Than_Extension_Duration

```solidity
error NFTMarketReserveAuction_Less_Than_Extension_Duration(uint256 extensionDuration)
```

#### Parameters

| Name              | Type    | Description                         |
| ----------------- | ------- | ----------------------------------- |
| extensionDuration | uint256 | The extension duration, in seconds. |

### NFTMarketReserveAuction_Must_Set_Non_Zero_Reserve_Price

```solidity
error NFTMarketReserveAuction_Must_Set_Non_Zero_Reserve_Price()
```

### NFTMarketReserveAuction_Not_Matching_Seller

```solidity
error NFTMarketReserveAuction_Not_Matching_Seller(address seller)
```

#### Parameters

| Name   | Type    | Description                   |
| ------ | ------- | ----------------------------- |
| seller | address | The current owner of the NFT. |

### NFTMarketReserveAuction_Only_Owner_Can_Update_Auction

```solidity
error NFTMarketReserveAuction_Only_Owner_Can_Update_Auction(address owner)
```

#### Parameters

| Name  | Type    | Description                   |
| ----- | ------- | ----------------------------- |
| owner | address | The current owner of the NFT. |

### NFTMarketReserveAuction_Too_Much_Value_Provided

```solidity
error NFTMarketReserveAuction_Too_Much_Value_Provided()
```

### SendValueWithFallbackWithdraw_No_Funds_Available

```solidity
error SendValueWithFallbackWithdraw_No_Funds_Available()
```
