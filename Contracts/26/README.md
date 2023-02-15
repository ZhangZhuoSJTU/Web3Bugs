##  Contents
 - [Intro](#bookmark_tabs-introduction)
 - [Overview of the contracts](#mag-overview-of-the-contracts-mag)
   - [RCmarket.sol](#convenience_store-rcmarketsol)
   - [RCFactory.sol](#factory-rcfactorysol)
   - [RCTreasury.sol](#bankrctreasurysol)
   - [RCOrderbook.sol](#notebook_with_decorative_coverrcorderbooksol)
    - [RCLeaderboard.sol](#1st_place_medalrcleaderboardsol)
   - [Nft Hubs](#sparkles-nft-hubs)
 - [Governance](#mortar_board-governance-mortar_board)
 - [Key aspects to the contracts](#key-key-aspects-to-the-contracts-key)
 - [Known Issues](#confused-known-issues-confused)
 - [Protections](#closed_lock_with_key-protections-closed_lock_with_key)
 - [Quick Reference](#quick-reference)
## :bookmark_tabs: Introduction

Reality Cards is an NFT based prediction market. Instead of betting on an outcome, each outcome is represented by an NFT, and users compete amongst each other to rent it. Users submit bids to rent each outcome at a given price, and at any time it will be rented by whoever offers the highest rental price. All rent goes into a central pot. At the end of the event, payout is done based on length of ownership; the NFT itself becomes owned by whoever owned it the longest.

Reality Cards will be deployed on the layer 2 solution matic/polygon. All matic functions support meta-transactions. Thus, msgSender() should be used throughout instead of msg.sender.

A very high level overview of the system can be read here https://realitycards.io/faq.

## :mag: Overview of the contracts :mag:

There are a total of seven contracts. Five main contracts and two nft contracts that form a bridge between Matic and Eth.
The five primary contracts are:

### :convenience_store:	 RCMarket.sol
This is the market contract. Each event is a unique instance of this contract. The user interacts with this contract when renting Cards. 

### :factory:	 RCFactory.sol
This is the factory contract. This contract deploys the market contracts. A createMarket() function is called in order to create a new market. Clones are used: first, a reference market contract is deployed. Whenever createMarket() is called a clone (proxy) of the reference is created. The proxy is used for the state, but the reference contract is used for the logic. The Factory also stores all configurable parameters used for the markets.

### :bank:	RCTreasury.sol
This contract will hold all the tokens, they are never sent to market contracts. The user interacts with this contract whenever they deposit or withdraw tokens. The main point of this is that users can have a common deposit balance across all Cards on all events. When rent is paid, it does not go anywhere- it is moved from a user’s deposit balance to a market’s marketPot balance (via the marketBalance, explained later), within the Treasury contract. Likewise, claiming any winnings is the opposite. It is essential that all the functions that move funds between these two balances are called only by markets.

### :notebook_with_decorative_cover:	RCOrderbook.sol
This contract is where all the users' bids are stored. It also manages the correct placement of bids in the orderbook and locating new card owners. The reason for having a single contract to store all bids across markets is mainly for gas efficiency and to simplify the protections against certain attacks. 
E.g. When a user forecloses (when they run out of deposit to continue paying rent) then the treasury only needs to inform the orderbook instead of having to keep track of all open markets and inform them all.

### :1st_place_medal:	RCLeaderboard.sol
The Leaderboard keeps track of the users who have held the cards for the longest. At the end of the market the longest owner gets to keep the original NFT :1st_place_medal: and users further down the leaderboard may mint a copy :2nd_place_medal::3rd_place_medal:.

### :sparkles: Nft Hubs
Finally, there are two NFT contracts: RCNftHubL2.sol deployed on Matic and RCNftHubL1.sol deployed on Eth mainnet. These contracts are fundamentally copies of the Matic Mintable Asset contracts with a change to RCNftHubL2 such that only the Factory can mint NFTs and that moving (including upgrading) NFTs is restricted until the market has finished.

## :mortar_board: Governance :mortar_board:

There are three types of governance function, separated by the magnitude of what can be achieved.

  - **Governors** - Has limited power- approves markets, adds artists, etc. Multiple governors can be approved.
 - **Owner** - Has full power except to make upgrades. 
 - **uberOwner** - Can ‘upgrade’ the system by deploying new versions of each of the above listed contracts and pointing the other contracts to them. This includes deploying a new reference market contract, from which new clones will be created. It may become necessary to burn the uberOwner to prevent upgrades, thus it is split out from the normal owner. Alternatively we may wish for this to be a multisig but the normal owner to not be, for convenience. 

## :key:	 Key aspects to the contracts :key:		
 
### :moneybag: Rent collection mechanisms 

There are 2 rent collection mechanisms in use in the contracts. Each uses multiple functions and we refer to them as per-user rent collection and per-card rent collection. The 2 mechanisms work in tandem with per-user rent collection always being called before a per-card rent collection.

These 2 mechanisms are an essential part of allowing users to have one deposit pot that multiple cards (and multiple markets) can withdraw from in a fair manner. 

#### :man: Per-user rent collection
The per-user rent collection is only interested in the rent as a whole that an individual user owes over a given period of time. There is no concept of separate markets or cards in the per-user rent collection, if there was then it would be too gas intensive to update the rental payments for every card a user could be paying rent for and so it would be required to put limits on the maximum number of bids a user can place.

When the per-user rent collection takes rent from the users deposit it puts the rent into the marketBalance. The marketBalance can be thought of as a shared pot of rent that is due to be paid, but the card it is to be paid on isn’t known at this time. Any market can claim this rent for any card and because we have called for the per-user rent collection before the per-card rent collection there should always be enough in the marketBalance to pay the per-card rent.

#### :flower_playing_cards: Per-card rent collection
This rent collection is only focused on a single card and its owner. It uses the price of the card and the time the owner has held it to calculate how much rent is due. In the simple case this rent collection will be performed because a new user has placed a high enough bid to become the new owner of the card, it is easy enough to collect rent on this card up to the block.timestamp and assign ownership to the new owner. 

However there are cases where the ownership of a card can change without contract interaction and as such per-card rent collection needs to be able to cope with potentially many of these events. They are:
 - User foreclosure (deposit hits zero)
 - Card Time limit
 - Market locking

On a per-card rent calculation any combination of these events may be discovered to have happened or not. As the order of these events is also important this leads to several permutations of what can happen within a per-card rent calculation. The most complex of these events is when either a time limit was hit or the market locked. This is because in these cases the per-user rent collection will have collected more rent from the user than was necessary and as such it is required to give the user a partial refund.

### :notebook: Orderbook bid storage
The orderbook holds all of a given users’ bids in an array of Bid records, each Bid record stores the specifics of the bid (price, time limit, market etc) and the address of the user above and below this bid in the orderbook. There is also an index mapping which stores the position in the users bid array for a given record, this prevents the need to iterate through the array to find a given record (at the expense of storage costs).

When a market is created a zero value Bid record is also created for each card and the market address is used as the owner of this bid. This becomes the head/tail of a doubly linked circular list. In this manner the owner of a card may be located by going to the market Bid record and looking at the address in the next field. By repeatedly looking up the Bid record for the user in the next field the whole orderbook for a given card may be traversed eventually ending back up at the markets’ own bid record.

After a market has completed it might not be possible to delete all the bids in storage so they are placed in a new linked list called the waste pile. The waste pile uses the address of the orderbook contract itself as the owner of the array.

## :confused:	 Known Issues :confused:	

### :balance_scale:	Rent collection rounding mismatch
Situations exist where the per-user rent collection mechanism doesn’t collect enough rent for the per-card rent collection mechanism. This is because when a user owns multiple cards the per-user rent collection can be called for multiple times before a given per-card rent collection is performed. When this happens the per-user rent collection will have rounded down it’s calculation multiple times and the per-card rent collection will only perform the rounding once. 

E.g. (assume for this scenario that USDC is the smallest unit) Alice owns a particular card for 5 USDC/day, After 12 hours if a per-user rent collection is performed it will claim 2 USDC for her, rounded down from 2.5 USDC. Then 12 hours later we perform both rent calculations, the per-user rent calculation will collect another 2 USDC leaving 4 USDC in the marketBalance. However the per-card rent calculation will attempt to collect for the full 24 hours and needs 5 USDC.

In practice the mismatch is very small as we are rounding down to the nearest Wei. The mitigation to this is that the `payRent` function will reduce the rent collected by the per-card rent collection if there isn’t enough in the marketBalance. When this happens we track the discrepancy with marketBalanceDiscrepancy. We have also included the function topupMarketBalance which we will use to pre-seed the marketBalance and can periodically top it up as necessary. Due to rounding being so small, it will not cost much to seed the pot for many years to come.

### :fuelpump: Rent collection gas limit
As multiple users could foreclose and/or hit card time limits without user interaction there could exist a lengthy queue of events to process. The current limit is set to 50 rent iterations. When this limit is hit the rent calculation stops and the transaction completes, this can cause a slight unfairness for users further down in the orderbook under certain circumstances. If more than 50 users have either foreclosed or set card time limits that have expired (or any combination thereof) then when a new user places a bid the rent will be calculated for these 50 users and the correct time held allocated. However the 51st (and onwards) user should have also been given some ownership but we can't calculate this in this transaction and ownership is given to the new bidder. It should be noted that the new bidder does not gain extra time from this, they are given ownership from the time they placed the bid. This means that where the 51st bidder should have had ownership there was dead time on the card where nobody was renting it. To mitigate against this we have a rent collection bot that will predict user forclosures and card time limits and call for rent collections if necessary, in testing however this hasn't been necessary as normal user interaction keeps all the accounting current.

### :chart_with_downwards_trend: Premature user foreclosure
Due to the per-user rent collection potentially collecting more rent than necessary which requires giving the user a refund (explained in the per-card rent section) it might happen that a user is foreclosed earlier than they should be. The impact of this is that foreclosed users may have their bids deleted at any time and so a user may unfairly have their bids deleted early. The refundUser function mitigates against this by de-foreclosing the user. It is also expected that the minimum rental period will be reduced following further testing, as the minimum rental period reduces the impact of this will also be reduced.

### :see_no_evil: Oracle failure
Although well tested the oracle contracts are outside our control and the possibility of failure needs to be planned for. To this end we have a couple of protections. Firstly in the event the oracle returns an invalid answer all users have their rent returned (minus payment for artists and card affiliates), the market creator doesn’t receive payment however because in this case the market question was likely at fault. There also exists the possibility that although there is an oracle failure or an invalid answer given there is however a generally accepted answer and the owner role may call setAmicableResolution to override the oracle. 

e.g. in a market about whether the remains of the long march 5b rocket will hit land or water, there were disputes between international space agencies over if a part of the rocket hit the maldives (on land). In this case setAmicableResolution was used to answer "water" as it was generally accepted that this was the answer to the spirit of the question and the Pot size wasn’t sufficient to warrant calling for the arbitrator.

## :closed_lock_with_key: Protections :closed_lock_with_key:

These are a few of the key protection mechanisms we have put in place for various attacks we have considered.

### Minimum rental period
Without a minimum rental period it would be possible to place zero length bids, either by having no deposit, withdrawing deposit after placing bids or setting very short time limits, this causes problems because of gas limits an attacker could gain some ownership of a card and then stuff the orderbook full of zero length bids. The outcome of this would be a lot of dead time on the card and therefore the attacker would gain a greater proportion of the winnings for themselves without having to risk paying rent.

### Minimum bid increase percentage (currently 10%)
This is mainly to even the playing field between superusers/bots and other users. It can be a very poor user experience if every time you place a new bid somebody else outbids it by a tiny fraction. The minimum bid increase means that the markets can more quickly find their equilibrium point. 

This does increase the complexity of adding bids to the orderbook because we need to maintain the 10% spacing throughout. Otherwise it would be possible to outbid the current owner by 10% on a spare account, then place an underbid just above the previous owner, then remove the bid on the spare account (having only spent the minimum rental). To prevent this when a user attempts to place a bid that is less than 10% above an existing bid their bid price will be reduced to match the existing bid and placed behind it in the orderbook. 

The above, and various other considerations, are detailed [here](https://docs.google.com/document/d/19AeyrOzVYFTmW2_aWF-c07CrURb1-zb5O6ny9Y7wGKM/edit).

## Quick reference

**Arbitrator** - Should the oracle answer be disputed this can be used to settle the dispute. Ideally this is never needed and the cost in calling for it is the deterrent to causing a dispute in the first place.

**Bid Rate (bidRate)** - The sum of all bids a user has placed, used to calculate if they can afford the minimum rental for all their bids. If not they are declared foreclosed.

**Bid** - The price a user is willing to pay to own the card. Only the highest bid becomes the owner of the card and pays this.

**Card** - An NFT that represents a potential outcome of a market, this is what users rent to gain ownership time and a share of the prize pot. The user with the highest ownership time at the end of the market can keep the NFT and has full control over it.

**Foreclosure** - The user can’t afford to pay the minimum rental for all cards they have bids on, in this state all their bids are eligible for deletion.

**Market** - An instance of the market contract that represents the question users are trying to predict the answer to.

**Oracle** - A crowdsourced information source (specifically https://reality.eth.link/)  that provides the answer to the question being asked in the market.

**Owner** - The user that has the highest bid at any given time and is paying to ‘own’ the card.

**Rental Rate (rentalRate)** - The sum of all bids on cards the user is currently renting, used to reduce their deposit in the per-user rent calculation.

**Safe Mode** - An optional mode selected on market creation where the payout is modified such that the rent paid on the winning outcome is returned to the users instead of being added into the pot.

**Time Limit (timeHeldLimit)** - An optional parameter a user can set when placing a bid (and adjust at any time) that will exit their position after they have owned the card for this amount of time. Adjusting this isn’t considered the same as placing a new bid and the position in the orderbook is preserved. 

**Underbidding** - The act of placing a bid lower than the current highest bid. Usually because it is expected the current owner will run out of funds and ownership will pass down the orderbook.

**Winner takes all mode** - An optional mode selected on market creation where the payout is modified such that the longest owner of the winning card takes the entire pot.
