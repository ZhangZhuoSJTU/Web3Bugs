# Amun contest details
- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-amun-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 13, 2021 00:00 UTC
- Ends December 19, 2021 23:59 UTC


| Glossary| |
|-------------------------------|------------------------------------------------------|
|  Basket| A token that wraps multiple underlying tokens into one index Token |
| Rebalancing| Trading the underlying of a basket to change weights and add/remove underlying token |
| Root Chain | Ethereum / Goerlie |
| Child chain | Matic / Mumbai |

# Contest Scope
The focus for the contest is to try and find any logic errors or ways to drain funds from the protocol in a way that is advantageous for an attacker at the expense of users with funds invested in the protocol. Wardens should assume that governance variables are set sensibly (unless they can find a way to change the value of a governance variable, and not counting social engineering approaches for this). 

## Protocol overview
The amun basket protocol is an index token and the supporting contracts needed for interacting with it. 
The core contract is the `Basket` build from facets with the diamond standard. The Basket has facets adding ERC20, basket, and callManager functionality. Basket facet enables join/exiting the basket and removing/adding underlying. 
The `CallManager` facet enables manager to acct as the Basket. This allows `RebalanceManager` to rebalance the underlying. This contract can only be used by the owner and trades underlying via exchanges like uniswap.
The `SingleJoin` and `SingleExit` are helper contracts that enable buying/selling the underlying token from a single token like WETH.
The `Bridge` token are a pair of token enabling bridging the basket between ethereum and matic. This is done by deploying on ethereum and matic according to the Polygon PoS token standard. 

## Smart Contracts
All the contracts in this section are to be reviewed. Any contracts not in this list are to be ignored for this contest.
A further breakdown of [contracts and their dependencies can be found here](https://docs.google.com/spreadsheets/d/1JyHQbAwQq1G_PMl-V5YS5wJ6TzDUjiiCpNN1u7anqw0/edit?usp=sharing)

	
### Basket
The core contract is built in separate facets (modules) with the diamond standard:

#### BasketFacet (342 sloc)
This module enables handling underlying token. It holds core functionality for interacting with the token.  

 - Managing underlying token 
	- `addToken`/`removeToken`
	- `joinPool`/`exitingPool` with underlying
	- handling fees 
	- `calcTokensForAmount` underlying ratio needed to mint quantity of token 
	- `calcTokensForAmountExit` underlying returned when burning the basket (exit)


#### CallFacet (116 sloc)
 Enables other contracts to act as the Basket token and makes it possible to add new logic. The contracts in `callManager` use this module.

  - Adding and removing call manager `addCaller` and `removeCaller`
  - `call`, `callNoValue`, `singleCall` enable creating internal contract as the basket

#### ERC20Facet (218 sloc)
Adds ERC20 functionalities

### Call managers
Contracts that can be added to a Basket via the CallFacet, this acting as the basket

#### Rebalance managers
Enables rebalancing the underlying basket token by swapping underlying for new token via exchanges like uniswap. 
Different versions 
 - `RebalanceManager.sol` can swap on one uniswapV2 like exchange 
 - `RebalanceManagerV2.sol` can swap via multiple uniswapV2 and uniswapV3 like exchanges
 - `RebalanceManagerV3.sol` can swap over more then one exchange in each trade 

### SingleJoin
Enables swapping to all underlying token required for a basket in single transaction and join the basket

 - `EthSingleTokenJoin.sol` swapping from ETH to all underlying of a basket and joining basket
 - `SingleTokenJoin.sol` swapping from Token to all underlying of a basket and joining basket

 - `EthSingleTokenJoinV2.sol` swapping from ETH to all underlying via multiple exchanges of a basket and joining basket
 - `SingleTokenJoinV2.sol` swapping from Token to all underlying via multiple exchanges of a basket and joining basket

### SingleExit
Enables exiting a basket and swapping to all underlying token in a single transaction to a output token

 - `SingleNativeTokenExit.sol` exiting and swapping underlying token of a basket to single output token
 - `SingleNativeTokenExitV2.sol` exiting and swapping underlying token of a basket via multiple exchanges to single output token

### Bridge
Representation of a token on two different chains child/root using the matic PoS bridge ([HERE](https://docs.polygon.technology/docs/develop/ethereum-polygon/pos/getting-started/)). 

- `PolygonERC20Wrapper.sol` contract deployed on child side and wrapping a basket. This signals the matic bridge when to transfer from child to root chain via `withdraw` and `withdrawTo` and enables the user to call exiting function on the matic bridge and then minting `MintableERC20.sol` on the root chain.
- `MintableERC20.sol` contract deployed on root side and representing a basket on that chain. Locking the token on the bridge will signal matic to transfer underlying basket of `PolygonERC20Wrapper.sol` via `deposit` to the user on the child chain.

#### User interaction
User interaction start in either the deposit or withdraw handler. A user is treated differently depending on the size of the user and the type of interaction the user is doing, user interactions can be broken down in the following groups:


## Setup

Go to `contracts/basket` and `contracts/bridge`.

Create `.env` file to use the commands (see `.env.example` for more info):

- `PRIVATE_KEY` - Credentials for the account that should be used
- `INFURA_PROJECT_ID`- For network that use Infura based RPC

Then run:

 ```bash
 yarn 
 yarn compile 
```

## Deploy
### Deploying Basket Token and helper contracts
Go to `contracts/basket`.

Deploying the factory
```bash
npx hardhat --network [NETWORK] deploy-pie-factory`
```

Deploying an Basket 
Define what underlying tokens your basket should have and get the underlying token (uniswap/mint). 
Then define the correct ratios in `./allocations/{TOKEN_NAME}.json` to generate the Basket  
```bash
npx hardhat --network [NETWORK] deploy-pie-from-factory --factory [FACTORY_ADDRESS] --allocation ./allocations/{TOKEN_NAME}.json`
```

Deploying an RebalanceManager (caller/manager)
```bash
npx hardhat --network [NETWORK] deploy-rebalance-manager --basket [BASKET_ADDRESS] --uniswapv2 [UNISWAP_V2_ADDRESS]
```

Then add the RebalanceManager as a caller

```bash
npx hardhat --network [NETWORK] add-caller-to-basket --basket [BASKET_ADDRESS] --caller [CALLER_ADDRESS]
```

Deploy the single swap v1
```bash
npx hardhat --network [NETWORK] deploy-single-join-exit --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]
```

Deploy the single swap v2
```bash
npx hardhat --network [NETWORK] deploy-single-join-exit-v2 --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]
```

### Deploying Matic PoS Bridge Token

Go to `contracts/bridge`.

Deploy the child side token. This should wrap a basket token and be deployed on Matic/Mumbai. 
```bash
yarn tasks deploy-child-wpeco --basket [BASKET_ADDRESS] --network [NETWORK]
```

Deploy the root (ethereum/goerli) side token. 

```bash
yarn tasks deploy-root-wpeco --network [NETWORK]
```

Add mapping on [Mapper Matic](https://mapper.matic.today/map)

## Tests
A full set of unit tests are provided in folder `basket` and `bridge`. To run these do the following:

```bash
yarn test
```
