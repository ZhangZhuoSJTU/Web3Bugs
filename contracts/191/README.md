# Forgeries contest details
- Total Prize Pool: $36,500 USDC
  - HM awards: $25,500 USDC 
  - QA report awards: $3,000 USDC 
  - Gas report awards: $1,500 USDC 
  - Judge + presort awards: $6,000 USDC 
  - Scout awards: $500 USDC
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-12-forgeries-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 13, 2022 20:00 UTC
- Ends December 16, 2022 20:00 UTC

## C4udit / Publicly Known Issues

The C4audit output for the contest can be found [here](https://gist.github.com/Picodes/1060be69a981bf18fb2241609010db70) within an hour of contest opening.

*Note for C4 wardens: Anything included in the C4udit output is considered a publicly known issue and is ineligible for awards.*

We rely on `@chainlink/contracts` to supply `VRF` numbers and this contract clearly documents `chain.link` as a dependency for this project. Any issues directly related to the chainlink infastructure contracts other than incorrect configuration of their libraries within this project are not in scope for this audit.

# Overview

We want to raffle away a single NFT (_token_) based off of another NFT collection (or _drawingToken_) in a fair and trustless manner.

For instance, we could raffle off a single high value NFT to any cryptopunk holder, the punk that wins can choose to claim the NFT. If they do not claim, a re-roll or redraw can be done to select a new holder that would be able to claim the NFT.

The contract follows the hyperstructure concept (https://jacob.energy/hyperstructures.html) except for the dependency on chain.link (https://chain.link/).

We are utilizing the `chain.link` Verifiable Random Function (`VRF`) contract tools to fairly raffle off the NFT. Their `VRF` docs can be found at: https://docs.chain.link/vrf/v2/introduction/.

The main functions are `VRFNFTRandomDrawFactory.makeNewDraw()` to create a new non-upgradeable minimal clones proxy draw contract with your desired configuration. Each contract is separate to allow for easier UX and more security with interactions. After the drawing is created, it needs to be started which will pull the NFT from the creator/owner's wallet up for raffle when they call `VRFNFTRandomDraw.startDraw()`.

After the drawing is started, we will request a random entropy from chain.link using the internal `_requestRoll()` function. Once `chain.link` returns the data in the `fulfillRandomWords()` callback the raffle NFT will be chosen and saved. If the raffle NFT is burned or removed this will still complete and a redraw will need to happen to find an NFT that is active/accessible to draw the winning NFT. Most raffles will use a specific contract that users will have a high incentive to withdraw their winning NFT.

The winning user can determine if they have won by calling `hasUserWon(address)` that checks the owner of the winning NFT to return the winning user. They also can look at `request().currentChosenTokenId` to see the currently chosen winning NFT token id. Once they have won, they can call `winnerClaimNFT()` from the account that won to have the raffled NFT transferred to the winner.

If the winning user does not claim the winning NFT within a specific deadline, the owner can call `redraw()` to redraw the NFT raffle. This is an `ownerOnly` function that will call into `chain.link`.

If no users ultimately claim the NFT, the admin specifies a timelock period after which they can retrieve the raffled NFT.

# Scope

### Files in scope
|File|[SLOC](#nowhere "(nSLOC, SLOC, Lines)")|Description and [Coverage](#nowhere "(Lines hit / Total)")|Libraries|
|:-|:-:|:-|:-|
|_Contracts (4)_|
|[src/utils/Version.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/utils/Version.sol)|[10](#nowhere "(nSLOC:10, SLOC:10, Lines:16)")|[100.00%](#nowhere "(Hit:1 / Total:1)")||
|[src/VRFNFTRandomDrawFactoryProxy.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactoryProxy.sol) |[15](#nowhere "(nSLOC:15, SLOC:15, Lines:22)")|Proxy Contract linking to the Factory, &nbsp;&nbsp;-| [`@openzeppelin/contracts-upgradeable`](https://openzeppelin.com/contracts/)|
|[src/VRFNFTRandomDrawFactory.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactory.sol)|[41](#nowhere "(nSLOC:34, SLOC:41, Lines:60)")|Factory for VRF NFT Raffle, UUPS Upgradable by owner., &nbsp;&nbsp;[100.00%](#nowhere "(Hit:7 / Total:7)")| [`@openzeppelin/contracts-upgradeable`](https://openzeppelin.com/contracts/)|
|[src/VRFNFTRandomDraw.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDraw.sol) [♻️](#nowhere "TryCatch Blocks")|[196](#nowhere "(nSLOC:182, SLOC:196, Lines:321)")|This contract is the main escrow and VRF-integrated raffle contract, &nbsp;&nbsp;[86.67%](#nowhere "(Hit:52 / Total:60)")| [`@openzeppelin/contracts-upgradeable`](https://openzeppelin.com/contracts/) [`@chainlink/contracts`](https://github.com/smartcontractkit/chainlink)|
|_Abstracts (1)_|
|[src/ownable/OwnableUpgradeable.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/ownable/OwnableUpgradeable.sol)|[73](#nowhere "(nSLOC:61, SLOC:73, Lines:133)")|This contract is the main escrow and VRF-integrated raffle contract, &nbsp;&nbsp;[94.12%](#nowhere "(Hit:16 / Total:17)")| [`@openzeppelin/contracts-upgradeable`](https://openzeppelin.com/contracts/)|
|_Interfaces (3)_|
|[src/interfaces/IVRFNFTRandomDrawFactory.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/interfaces/IVRFNFTRandomDrawFactory.sol)|[11](#nowhere "(nSLOC:9, SLOC:11, Lines:25)")|Interface to the main VRFNFTRandomDraw contract, &nbsp;&nbsp;-||
|[src/ownable/IOwnableUpgradeable.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/ownable/IOwnableUpgradeable.sol)|[15](#nowhere "(nSLOC:15, SLOC:15, Lines:64)")|The interface to an owner safe-transferrable upgradeable openzeppelin fork, &nbsp;&nbsp;-||
|[src/interfaces/IVRFNFTRandomDraw.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/interfaces/IVRFNFTRandomDraw.sol)|[62](#nowhere "(nSLOC:55, SLOC:62, Lines:129)")|Interface to the factory VRFNFTRandomDrawFactory contract, &nbsp;&nbsp;-||
|Total (over 8 files):| [423](#nowhere "(nSLOC:381, SLOC:423, Lines:770)") |[89.41%](#nowhere "Hit:76 / Total:85")|


## External imports
* **@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol**
  * [src/VRFNFTRandomDraw.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDraw.sol)
* **@chainlink/contracts/src/v0.8/VRFCoordinatorV2.sol**
  * [src/VRFNFTRandomDraw.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDraw.sol)
* **@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol**
  * [src/VRFNFTRandomDrawFactory.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactory.sol)
* **@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol**
  * [src/ownable/OwnableUpgradeable.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/ownable/OwnableUpgradeable.sol)
* **@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol**
  * [src/VRFNFTRandomDrawFactory.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactory.sol)
* **@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol**
  * [src/VRFNFTRandomDraw.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDraw.sol)
  * [src/VRFNFTRandomDrawFactory.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactory.sol)
* **@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol**
  * [src/VRFNFTRandomDrawFactoryProxy.sol](https://github.com/code-423n4/2022-12-forgeries/blob/main/src/VRFNFTRandomDrawFactoryProxy.sol)



## Out of scope

1. OpenZeppelin dependency contracts
2. UUPS Proxy and OpenZeppelin implementation thereof
3. Chainlink dependency architecture / contracts
4. Issues / drawbacks of using specific EIP standards (EIP721 (NFT Token standard), EIP1167 (minimal proxies/clones))
5. The NFT up for raffle and NFT that is used for the raffle are non-malicious contracts not attempting to compromise this raffle contract (within reason). Assume creators of raffles will do checks to ensure that the NFT itself is not compromised or unusual preventing the functioning of the raffle contract.

# Additional Context

1. We have no unique curve logic or mathematical models in this contract.
2. This contract should prevent the owner from iterrupting the contest until the timelock unlocks at the end and preventing any users that do not win from withdrawing the NFT.

## Scoping Details 
```
- If you have a public code repo, please share it here:  https://github.com/0xigami/vrf-nft-raffle
- How many contracts are in scope?:   3
- Total SLoC for these contracts?:  320
- How many external imports are there?: 6 
- How many separate interfaces and struct definitions are there for the contracts within scope?:  2 structs, 2 interfaces
- Does most of your code generally use composition or inheritance?:   Code typically uses composition
- How many external calls?:   4
- What is the overall line coverage percentage provided by your tests?:  94
- Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?:   false
- Please describe required context:   
- Does it use an oracle?:  true
- Does the token conform to the ERC20 standard?:  N/A
- Are there any novel or unique curve logic or mathematical models?: N/A
- Does it use a timelock function?:  Yes
- Is it an NFT?: No (but NFTs get locked inside)
- Does it have an AMM?:   No
- Is it a fork of a popular project?:   false
- Does it use rollups?:   false
- Is it multi-chain?:  false
- Does it use a side-chain?: false 
```

# Tests


## Quickstart command

`rm -Rf 2022-12-forgeries || true && git clone https://github.com/code-423n4/2022-12-forgeries.git -j8 && cd 2022-12-forgeries && yarn && foundryup && yarn test-gas`

### To run tests:

1. Setup `yarn`: https://yarnpkg.com/getting-started/install
2. Setup `forge`: https://book.getfoundry.sh/getting-started/installation
3. Install dependencies: run `yarn`
4. Run tests: run `yarn test`

### Slither notes:

1. This project is tested and works with Slither v 0.9.0
2. Slither will have issues with the try/catch blocks upon first test
3. All test files and files from `chain.link` have issues that are out of scope in the repo for Slither.
