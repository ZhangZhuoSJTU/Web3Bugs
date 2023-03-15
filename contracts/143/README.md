# Juicebox V2 contest details
- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-07-juicebox-v2-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts July 1, 2022 20:00 UTC
- Ends July 8, 2022 20:00 UTC
- The [Juicebox contracts](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5) to be audited

# Juicebox Protocol

## What is Juicebox?
The Juicebox protocol is a programmable treasury. Projects can use it to configure how its tokens should be minted when it receives funds, and under what conditions those funds can be distributed to preprogrammed addresses or reclaimed by its community. These rules can evolve over funding cycles, allowing people to bootstrap open-ended projects and add structure, constraints, extensions, and incentives over time as needed. The protocol is light enough for a group of friends, yet powerful enough for a global network of anons sharing thousands of ETH, ERC-20s, or other assets.

The protocol is nuanced, however. The goal of the [protocol docs](https://info.juicebox.money/) is for you to find any protocol related information that you're looking for. These docs should allow you to click around and get a real good deep dive, and should just as easily allow you to find overview information.

Watch the [audit intro](https://youtu.be/FMMuuG-g3Ac) to learn more.

## How to approach the Juicebox Code4rena audit
The Juicebox protocol is entirely unique. To understand how the protocol works, we *highly* suggest you read through the extensive documentation on http://info.juicebox.money. First, get an overview of the docs in the [Learn](https://info.juicebox.money/dev/learn) section, then dive into the main functional routines in [Build/Basics](https://info.juicebox.money/dev/build/basics). 

Please note: As a flexible and extensible fundraising protocol, Juicebox is aware of many attack vectors that are part of its design. Please make sure when reporting bugs that you are *not* including known risks addressed on the [Risks](https://info.juicebox.money/dev/learn/risks) page of the documentation. If you are unsure if something you've found constitutes a known risk, please feel free to reach out to a member of our team or report it anyway and we will evaluate the validity of the reported bug during the post-contest review phase. 

If you have questions about the protocol or where to start, don't hesitate to reach out in our [Discord](https://discord.gg/juicebox) or DM our development team (see Contact Information below).

## How to setup the project
Go to the [Juicebox v2 Code4rena code repo](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5) and follow instructions in the readme.

## Contact Information

| Contact| Discord | Telegram | Twitter|
| -------- | -------- | -------- | -----|
| Jango     | jango#0420     | [me_jango](https://t.me/me_jango)     | [me_jango](https://twitter.com/me_jango/)     |
|DrGorilla | DrGorilla.eth#8862 | [DrGorilla_md](https://t.me/DrGorilla_md) | [DrGorilla_md](https://twitter.com/DrGorilla_md) |
| LuckyKoala | LuckyKoala#1024 | |[twodam_eth](https://twitter.com/twodam_eth/)|
| Nicholas | nicholas#7777 | nnnnicholas | [nnnnicholas](https://twitter.com/nnnnicholas) |

## Contest Scope
Consult the [Juicebox Contracts here](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5) (commit 828bf2f). We HIGHLY ADVISE you consult the comprehensive and high quality [Juicebox Documentation](http://info.juicebox.money). Salient details are summarized below for convenience, but the real docs are where you should start.

### In Scope
The protocol is made up of 7 core contracts and 3 surface contracts. All of these contracts are **in scope**. For more information on these contracts and how they fit together, please visit the [Architecture](https://info.juicebox.money/dev/learn/architecture) page of the docs.

#### Core contracts

Core contracts store all the independent components that make the protocol work. 

|File|SLOC|Description|
|-|-|-|
|[contracts/JBTokenStore.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBTokenStore.sol)| 135 |Manage token minting, burning, and account balances.|
|[contracts/JBFundingCycleStore.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBFundingCycleStore.sol)| 287 |Manages funding cycle scheduling.|
|[contracts/JBProjects.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBProjects.sol)| 42 |Stores project ownership and identifying information.|
|[contracts/JBSplitsStore.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSplitsStore.sol)| 101 |Stores splits information for all groups of each project. Projects can create split groups for directing percents of a total token allocation to any address, any other Juicebox project, or any contract that inherits from the IJBSplitAllocator interface.|
|[contracts/JBPrices.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBPrices.sol)| 26 |Manages and normalizes price feeds. |
|[contracts/JBOperatorStore.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBOperatorStore.sol)| 50 |Stores operator permissions for all addresses. Addresses can give permissions to any other address to take specific indexed actions on their behalf.|
|[contracts/JBDirectory.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBDirectory.sol)| 93 |Keeps a reference of which terminal contracts each project is currently accepting funds through, and which controller contract is managing each project's tokens and funding cycles.|


#### Surface contracts

Surface contracts glue core contracts together and manage funds. Anyone can write new surface contracts for projects to use.

|File|SLOC|Description|
|-|-|-|
|[contracts/JBController.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBController.sol)| 361 |Stitches together funding cycles and community tokens, making sure all activity is accounted for and correct.|
|[contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/abstract/JBPayoutRedemptionPaymentTerminal.sol)| 598 |Generic terminal managing all inflows and outflows of funds into the protocol ecosystem.|
|[contracts/JBSingleTokenPaymentTerminalStore.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBSingleTokenPaymentTerminalStore.sol)| 314 |Manages all bookkeeping for inflows and outflows of funds from any IJBSingleTokenPaymentTerminal.|
|[contracts/JBETHPaymentTerminal.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBETHPaymentTerminal.sol)| 39 |Manages all inflows and outflows of ETH funds into the protocol ecosystem.|
|[contracts/JBERC20PaymentTerminal.sol](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/JBERC20PaymentTerminal.sol)| 42 |Manages all inflows and outflows of an ERC20 into the protocol ecosystem.|
|Total (Core + Surface contracts)| 2,088||

#### Interfaces
All interfaces are in scope.

#### External calls

The protocol makes 1 external call to Chainlink to find ETH price in USD. If projects bring their own ERC-20, then the protocol will make calls to that contract.

#### Libraries

See the [libraries directory](https://github.com/jbx-protocol/juice-contracts-v2-code4rena/tree/828bf2f3e719873daa08081cfa0d0a6deaa5ace5/contracts/libraries). 

- @chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol
- @openzeppelin/contracts/access/Ownable.sol
- @openzeppelin/contracts/security/ReentrancyGuard.sol
- @openzeppelin/contracts/token/ERC20/IERC20.sol
- @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol
- @openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol
- @openzeppelin/contracts/token/ERC721/IERC721.sol
- @openzeppelin/contracts/token/ERC721/extensions/draft-ERC721Votes.sol
- @openzeppelin/contracts/utils/Address.sol
- @openzeppelin/contracts/utils/introspection/ERC165.sol
- @openzeppelin/contracts/utils/introspection/IERC165.sol
- @paulrberg/contracts/math/PRBMath.sol
- @paulrberg/contracts/math/PRBMathUD60x18.sol


### Out of Scope

The following utility contracts are out of scope.

- JBETHERC20ProjectPayer
- JBETHERC20ProjectPayerDeployer
- JBETHERC20SplitsPayer
- JBETHERC20SplitsPayerDeployer
