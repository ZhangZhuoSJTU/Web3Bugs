# Citadel
Citadel is the microstrategy of the people - it’s a community owned BTC focused fund. The contracts are designed to enable the vision.

## Swapping

Users swap assets for citadel, at a discount compared to the prevailing market rate. In exchange for this discount, their citadel is provided in staked form, which requires a vesting period to withdraw. However, while staked, this citadel earns interest from emissions.

There is an initial swapping period called the [Knighting Round](./knighting-round.md) that has some special properties. In this round, users on the guest list can swap for citadel at a fixed price, and support their favorite DAO among the knights.

## Go Live

During the Knighting round, the rest of the system isn't live. Users don't actually get their citadel during the knighting round, they get a reciept for it which can be claimed during the "go live" event.

During this event, a number of things happen:
* The initial citadel supply is minted and sent to it's proper destinations.
* Users are able to claim their rightful citadel from the knighting round.
* The DAO creats the Curve V2 pool and seeds the initial liquidity.
* The initial set of continuous funding contracts are opened.
* Staking and Locking are now possible.

## Minting & Emissions

Citadel has an emissions schedule. This schedule is defined by this formula and approximated via the SupplySchedule logic.

As we cant have the function continuously updating on-chain, we need an action to update the state. We could do it on user action, but this would lead to price increases for users who happen to trigger the state update.

The citadelMinter can be pinged to enact the tokenomics.
- Mint citadel according the schedule
- Send it to the right places (allocating for funding, emitting to stakers, or emitted to lockers)

## Staking
Users can stake their citadel for xCitadel, the staked version. The staked version has a vesting withdrawal period. 

xCitadel holders recieve xCitadel emissions in an auto-compounding manner. These gains are realized on withdrawal.


## When users swap assets for citadel, they receive it in xCitadel for 
Users can lock their xCitadel for an epoch to recieve addition rewards. This includes additional xCitadel and potentially other reward tokens.


