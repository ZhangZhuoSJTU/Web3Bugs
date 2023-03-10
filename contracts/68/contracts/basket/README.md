## Description

This is a Basket token based on the Diamond standard, this standard ensures contracts can grow beyond their restricted size. ([extra info](https://dev.to/mudgen/ethereum-s-maximum-contract-size-limit-is-solved-with-the-diamond-standard-2189))
This is based on [PieVaults](https://github.com/pie-dao/PieVaults)

See the [forum post](https://forum.piedao.org/t/pool-experipie/210) for more information.

Depends on https://github.com/mudgen/diamond-2


### Call Managers

CallManagers are addresses which are whitelisted to trigger arbitrary calls from the Basket. A whitelisted caller can be added by calling `addCaller(_newCaller)` on the Basket from the contract owner. 
⚠️ This should be used with caution as it allows any token within an ExperiPie to be pulled out ⚠️. Only trusted addresses or smart contracts should be added as callers.

- RebalanceMangers - Enable trading the baskets underlying token to rebalance the index constitution (only owner). 

### Facets
These are the baskets modular functions split up in different `facets` according to Diamond standard.
- Basket - IS the main part that enables the basket functionality as holding underlying, join, exit, ..
- Call - Enables adding Call Managers that can trigger arbitrary calls as the basket
- ERC20 - Standard ERC20 functionalities

## Deploying the factory
`npx hardhat deploy-pie-factory --network [NETWORK]`

## Deploying an Basket

1. Create an allocation file like [this one](/allocations/EXAMPLE.json)
2. run `npx hardhat deploy-pie-from-factory --allocation [PATH_TO_ALLOCATION] --factory [FACTORY_ADDRESS] --network [NETWORK]`
3. Copy the tx hash and search on Etherscan to find the address

## Deploying Rebalance Manager

1. run `npx hardhat --network [NETWORK] deploy-rebalance-manager --basket [BASKET_ADDRESS] --uniswapv2 [UNISWAP_V2_ADDRESS]`
2. run `npx hardhat --network [NETWORK] add-caller-to-basket --basket [BASKET_ADDRESS] --caller [REBALANCE_MANAGER_ADDRESS]`


## SingleJoin/SingleExit

For v1:
1. run `npx hardhat --network [NETWORK] deploy-single-join-exit --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]`

For v2:
1. run `npx hardhat --network [NETWORK] deploy-single-join-exit-v2 --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]`

