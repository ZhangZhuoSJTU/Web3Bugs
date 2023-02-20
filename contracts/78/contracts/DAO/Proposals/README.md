# Definition

A Proposal is a contract that executes an action on the DAO. Proposals are voted on by holders of the non transferrable voting points, Fate

## Proposals in this repo

While the execution of proposals happens on chain, the types of proposals in this directory can be voted on off chain after some discussion.
Snapshot is a good example of how this can happen. If there is overwhelming consent for a proposal then it isn't necessary for many people to devote Fate to seeing victory. This is all subject to community dynamics.
The list of proposals in this directory is by no means exhaustive. If a new type of proposal is desired by the community, it can be added to the collection by following the Proposal Life Cycle correctly.

# Proposal Life Cycle

## Community Consent

The first step in having a proposal accepted is to poll the community for the validity of the existence of such a proposal. This is not to poll whether the community agrees with the proposal but whether the community agrees that the existence of such a proposal is valid. This is a security measure. For instance, suppose a new dapp is being offered up to the Behodler Ecosystem that requires the power to mint Flan. At this stage, the community isn't debating whether the decision to mint is correct but whether the contract address specified by the proposal matches the purported new dapp.
Community consent, by definition, is a social offchain activity and whether this happens as a formal Snapshot vote or a bloodlust of Twitter attacks is subject to the culture of the community.

## Whitelisting

Once offchain community consent is acquired, the first onchain activity is to whitelist the proposal. This is a formalization of the community consent that this particular contract constitutes a valid proposal.

## Parameterization
Proposals should be parameterized before being lodged. A modifier is provided to lock parameterize the function once the proposal is lodged. Compliance with this standard is not enforced at the point of lodging so the community is strongly discouraged to reject any proposal which doesn't force itself into a readonly state during lodging. A simpler alternative would be to have the proposal only parameterize in the constructor. However, since each proposal has to go through a whitelisting stage, this reduces reusability. Instead it would be desirable to re-use an already whitelisted proposal many times but each time parameterize can be invoked before lodging.

## Lodge

At this point, anyone with sufficient Fate can lodge a proposal by staking Fate.

## Vote 
Once lodged, the proposal can be voted on for a certain duration. Positive voting == YES, Negative == NO. Absolute value is deducted from Fate balance.

## Decision
If the proposal passed, the proposer is returned half of the Fate they put up for lodging. The proposal is then executed or ignored. It then enters into a dormant state. If the notCurrent modifier is applied to a parameterize function, this function now becomes accessible again.


# How to add your own proposal
This section will be updated and currently is only a suggestion. We require an issue template on github to allow users to suggest new proposal contracts with solidity inlined in the issue. The community can then vote on the issue in Snapshot.
Once successful, a pull request should be created to include the new proposal in this directory.
At this point, the onchain portion of the life cycle commences and the white list vote should occur.