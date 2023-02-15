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

## Tests

A full set of unit tests are provided in the repo. To run these do the following:

## Prepare local enviroment

1. install `nodejs`, refer to [nodejs](https://nodejs.org/en/)
2. run `npm install`
3. run `npm run test` command in terminal