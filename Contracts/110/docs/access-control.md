# Access Control
The Citadel system uses Openzeppelin's [Role-based access control](https://docs.openzeppelin.com/contracts/4.x/access-control) paradigm to manage permissions.
Role permissions are stored in a central place, the **GlobalAccessControl** contract (GAC).

When we don't use the GAC to permission calls, it's for one of the following reasons:
- There are multiple instances of a given contract, and some of the permissioned roles are unique to each instance
  - (e.g. an oracle that feeds price data to a funding contract for a specifc asset)
- The contract was forked from another source and not modified in the interest of preserving audited code

# The Roles
## Governance 🏰
The big one - contract governance. This manages all critical functionality for the integrity of the system, such as access control, upgradeability, and anything that touches significant funds within the contracts.

Everything action governance takes is gated by a timelock, so that actions can be reviewed and flagged by others.

## Policy Ops 👨‍🔬
As it stands, Citadel requires some active parameter management to follow the tokenomic model.
- How should newly minted tokens be distributed among the funding pools, stakers, and lockers?
- What discount rate should apply for Funding with a certain asset?

Everything the policy ops team does is in theory automatable over time, but will be managed by a nimble team while that code and underlying logic matures.

### Security example: Discount Rates
Governance sets the minimum and maxmimum discount that can apply to a Funding contract. Setting a very high discount can allow someone to aquire the citadel in there effectively for free. 

However, discount rates should also respond quickly to market conditions. Using governance to set discount rates would lead to slow, timelocked actions. So, the lighter and nimbler Policy Ops team can manage the discount within the 'safe bounds' set by governance.

In the future, the specific discount rate could also be automated by leveraging the currently unused _discountManager_ contract. It still would be gated by min / max values specified by governance for security.

## Treasury Vault 🏦
The treasury vault is a high-security entity that manages the Citadel treasury. 

## Treasury Ops 💸
Treasury ops is a lighter, nimbler entity than can be granted control over a certain amount of funds at a time by the treasury vault for rapid processing (say, for trading it at optimal times on the market or doing a series of rapid actions).

It can also sweep assets to the treasury vault. (This is an example of a call that could in theory be permissionless, but will be kept gated for now.)

## Keeper 🤖
Keepers are permissioned EOAs used for bots to ping updates to the system. When the keeper role is used, the call could usually be permissionless (in theory). However, opening up a call leads to a large surface of potential attack vectors and so these are kept mildly-permissioned until sufficient confidence is gained to open the call.
