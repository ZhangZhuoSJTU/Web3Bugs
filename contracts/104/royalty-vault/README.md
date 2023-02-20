## Protocol overview

Joyn is an ecosystem of talent, knowledge and resources for emerging creators to co-create, promote and launch NFT projects. We provide project blueprints (project page, milestones, prompts), web3 building blocks (NFT membership passes, royalty splits, airdrops, output collections), and community resources (network of co-creators and support programs)

Our mission is to make the process of creative collaboration accessible to as many as possible, and to empower every creator regardless of their number of followers, knowledge, or access to resources.

Looking into the future we want to become a go-to platform for metaverse content creation, and to see a lot of cross-pollination and remixing among the projects built with Joyn.

We fully embrace modularity and interoperability with our architecture. We have modules that extend the ERC721 standards, which provide functionalities beyond minting and transferring token instances.

Eg. NFT collections launched through Joyn out of the box allow project creators to split royalties among an arbitrary number of recipients, which means we could achieve shared royalties between everyone involved in the project.

This paves the way for open co-creation of web3 content, where all contributors may share ownership and royalties, and benefit directly from the project’s success.

With that as a foundation, this will also unlock content attribution / remixing as a new class of use case based on inter-referencing projects.

## Smart Contracts

Here is high level [System Diagram](https://drive.google.com/file/d/1INWkGedjKihSWM6R0apomoUgiadujz4Y/view?usp=sharing)

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

## Additional information

### Royalty Vault

Every time a token is transferred, a collection will attempt to push funds from the royalty vault to the split contract via a hook called \_beforeTransfer.

Royalties will be sent to the vault from marketplaces like Opensea. We currently haven't implemented an royalty on-chain mechanism like ERC2981 yet but it will be implemented in the future.

### Split

The splits repository has been forked from this [mirror-xyz/splits](https://github.com/mirror-xyz/splits) Github repository.

More information about how the split mechanism works can be found [here](https://dev.mirror.xyz/V_7Jp1hy_g8bz-J1B4Wb5KYSmj5Lt4W7q7cw0noxJsU)

## Tests

A full set of unit tests are provided in the repo. To run these do the following:

## Prepare local enviroment

1. install `nodejs`, refer to [nodejs](https://nodejs.org/en/)
2. run `npm install`
3. run `npm run test` command in terminal