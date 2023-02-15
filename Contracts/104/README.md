# Joyn contest details

- \$28,500 USDC main award pot
- \$1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.com/invite/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-joyn-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 30, 2022 00:00 UTC
- Ends April 01, 2022 23:59 UTC

# Contest Scope

This contest is open for three days. Representatives from Joyn will be available in the Code Arena Discord to answer any questions during the contest period. The focus for the contest is to try and find any logic errors or ways to drain fungible or non-fungible assets from the protocol in a way that is advantageous for an attacker at the expense of users with funds in the protocol.

## Protocol overview

Joyn is an ecosystem of talent, knowledge and resources for emerging creators to co-create, promote and launch NFT projects. We provide project blueprints (project page, milestones, prompts), web3 building blocks (NFT membership passes, royalty splits, airdrops, output collections), and community resources (network of co-creators and support programs)

Our mission is to make the process of creative collaboration accessible to as many as possible, and to empower every creator regardless of their number of followers, knowledge, or access to resources.

Looking into the future we want to become a go-to platform for metaverse content creation, and to see a lot of cross-pollination and remixing among the projects built with Joyn.

We fully embrace modularity and interoperability with our architecture. We have modules that extend the ERC721 standards, which provide functionalities beyond minting and transferring token instances.

Eg. NFT collections launched through Joyn out of the box allow project creators to split royalties among an arbitrary number of recipients, which means we could achieve shared royalties between everyone involved in the project.

This paves the way for open co-creation of web3 content, where all contributors may share ownership and royalties, and benefit directly from the project’s success.

With that as a foundation, this will also unlock content attribution / remixing as a new class of use case based on inter-referencing projects.

## Smart Contracts

All the contracts in this section are to be reviewed. Any contracts not in this list are to be ignored for this contest.
A further breakdown of [contracts and their dependencies can be found here](https://docs.google.com/spreadsheets/d/12-igT0ks2Skib3Izv5u88D1wJsDNqokHquIoNXNCA2Q/edit?usp=sharing)

Here is high level [System Diagram](https://drive.google.com/file/d/1INWkGedjKihSWM6R0apomoUgiadujz4Y/view?usp=sharing)

### CoreCollection.sol (310 sloc)

ERC721 contract responsible for:

- Minting tokens
- Sending ERC20 tokens to the royalty vault
- Sending ERC20 tokens from the royalty vault to the split contract

Libraries used:

- Openzeppelin ERC721, Ownable & ERC721Enumerable

### CoreFactory.sol (167 sloc)

Contract responsible for:

- Deploying NFT collections for a project

### CoreProxy.sol (37 sloc)

Contract used for deploying instances of CoreCollection.
We use the proxies for gas optimization and will allow us to upgrade our users contracts in the future.

Libraries used:

- Openzeppelin Ownable

### ERC721Claimable.sol (100 sloc)

An abstract contract that extends the functionality of ERC721.
This contract makes the CoreCollection contract claimable. The collection owner is able to airdrop tokens from its collection to a big amount of users. Addresses receiving the airdrop are then able to claim tokens
for free by calling the mintToken function.

This contract uses Merkle tree to verify if an address is elligible for a claim.

This contract is responsible for:

- Verifying if an address can claim a token
- Allowing the owner to airdrop tokens

Libraries used:

- Openzeppelin MerkleProof

### ERC721Payable.sol (57 sloc)

An abstract contract that extends the functionality of ERC721.
This contract makes the CoreCollection contract payable. Once a token get minted, this contract
is responsible for handling the payment made. The payment will either be sent to the royalty vault
or be kept within the collection contract.

This contract is responsible for:

- Handling payment routing

Libraries used:

- Openzeppelin IERC20

### ProxyVault.sol (48 sloc)

Contract used for deploying instances of RoyaltyVault.
We use the proxies for gas optimization and will allow us to upgrade our users contracts in the future.

Libraries used:

- Openzeppelin Ownable

### RoyaltyVault.sol (104 sloc)

ERC721 contract responsible for:

- Receiving ERC20 tokens from collections revenue whether it is from primary sales or royalties from secondary sales
- Sending ERC20 to split contract
- Sending ERC20 tokens from the royalty vault to the split contract

Libraries used:

- Openzeppelin Ownable & ERC20

### SplitFactory.sol (175 sloc)

ERC721 contract responsible for:

- Deploying split & royalty vaults contracts
- Updating the platform fee and platform fee recipient of a royalty vault

Libraries used:

- Openzeppelin Ownable

### SplitProxy.sol (101 sloc)

Contract used for deploying instances of Splitter.
We use the proxies for gas optimization and will allow us to upgrade our users contracts in the future.

### Splitter.sol (195 sloc)

A contract that allows co-creators to share revenue generated by a project.
This contract uses Merkle tree to verify if a user can claim a share of the revenue.

This contract is responsible for:

- Defining revenue splitting rules
- Allowing co-creators to claim revenue from sales of a collection

## Additional information

### Royalty Vault

Every time a token is transferred, a collection will attempt to push funds from the royalty vault to the split contract via a hook called \_beforeTransfer.

Royalties will be sent to the vault from marketplaces like Opensea. We currently haven't implemented an royalty on-chain mechanism like ERC2981 yet but it will be implemented in the future.

### Split

The splits repository has been forked from this [mirror-xyz/splits](https://github.com/mirror-xyz/splits) Github repository.

More information about how the split mechanism works can be found [here](https://dev.mirror.xyz/V_7Jp1hy_g8bz-J1B4Wb5KYSmj5Lt4W7q7cw0noxJsU)

## Areas of concern for Wardens

We would like wardens to focus on any core functional logic, boundary case errors or similar issues which could be utilized by an attacker to take fungible or non-fungible assets away from clients who have funds deposited in the protocol, whether it is in royalty vaults, split or collection contracts. That said any errors may be submitted by wardens for review and potential reward as per the normal issue impact prioritization. Gas optimizations are welcome but not the main focus of this contest and thus at most 5% of the contest reward will be allocated to gas optimizations. For gas optimizations the most important flows are client collection, split and royalty vault contract deployments.

If wardens are unclear on which areas to look at or which areas are important please feel free to ask in the contest Discord channel.

## Tests

A full set of unit tests are provided in the repo. To run these do the following:

## Prepare local enviroment

1. install `nodejs`, refer to [nodejs](https://nodejs.org/en/)

In each folder (core-contracts, royalty-vault, splits):

1. run `npm install`
2. run `npm run test` command in terminal

For the splits folder, you will need to:

1. run `cp .env.example .env`
2. set those two env variables: `ALCHEMY_API_KEY={your key}` & `DEPLOYER_PRIVATE_KEY={your private key}`
