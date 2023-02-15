# Sushi Trident Contest Details
- 15,200 Sushi (~$190,000) main award pot
- 800 Sushi (~$10,000) gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-sushi-trident-contest-phase-1/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 16, 2021 at 00:00 UTC
- Ends September 29, 2021 at 23:59 UTC

# Contest Scope

The focus for the contest is to try to find any errors in the logic of the Trident contract code that would enable an attacker to steal funds from any of the contracts, or do anything that is advantageous for an attacker at the expense of users. Wardens should assume that governance variables are set sensibly; However, if the wardens are able to find a way to change the value of a governance variable such that users' funds could become susceptible to an attack as a result, this of course would be included in the scope of the contest. Wardens should not include social engineering approaches in this contest. Should you have any questions or urgent findings, representatives from Sushi will be available in the Code Arena Discord during the contest period. 

A secondary, considerably smaller, gas optimization award pot is also available for wardens who minimize the cost in gwei for interacting with the Trident contracts in the scope of this contest.

# Codebase
The full codebase may be found in this repository: https://github.com/sushiswap/trident
The relevant commit hash is 9130b10efaf9c653d74dc7a65bde788ec4b354b5 on the master branch.

# Protocol Overview

Trident is a liquidity market built to streamline DeFi’s most canonical AMM invariants into isomorphic pool types: Constant Product, Hybrid, and Index. Trident can be thought of as an environment where developers can natively piece together their own extensible AMM curves to be whitelisted on the Trident deployer, and the Trident router.

# Codebase

https://github.com/sushiswap/trident

# Documentation

Below is a list of all of the contracts that are in scope for this contest. Please note that contracts/pool/franchised/.sol is out of scope for this contest.

| Contracts | @notice |
|-------------------------------|------------------------------------------------------|
| Master Deployer.sol | Trident pool deployer contract with template factory whitelist. |
| TridentRouter.sol | Router contract that helps in swapping across Trident pools.|
| PoolDeployer.sol | Trident pool deployer for whitelisted template factories. |
| TridentERC20.sol | Trident pool ERC-20 with EIP-2612 extension. |
| ConstantProductPool.sol | Trident exchange pool template with Constant Product formula for swapping between an ERC-20 token pair. |
| ConstantProductPoolFactory.sol | Contract for deploying Trident exchange Constant Product Pool with configurations. |
| HybridPool.sol | Trident exchange pool template with hybrid like-kind formula for swapping between an ERC-20 token pair. |
| HybridPoolFactory.sol | Contract for deploying Trident exchange Hybrid Pool with configurations. |
| IndexPool.sol | Trident exchange pool template with constant mean formula for swapping among an array of ERC-20 tokens. |
| IndexPoolFactory.sol | Contract for deploying Trident exchange Index Pool with configurations. |

# Master Deployer 

https://github.com/sushiswap/trident/blob/master/contracts/deployer/MasterDeployer.sol

Below is a description of the Master Deployer, which is a smart contract that can be found by following the link above.

New pool templates can be whitelisted and deployed on Trident. The deployer contract handles the whitelisting and removal of these pools. Pools added to the deployer pay a fee to the Sushibar for each transaction, the percentage of which is set in the Deployer.

# Trident Router 

https://github.com/sushiswap/trident/blob/master/contracts/TridentRouter.sol

Below is a description of the Trident Router, which is a smart contract that can be found by following the link above.

While every type of pool on Trident is different, every pool essentially has the same swap function, as they all use the same routing engine, Tines. Tines is a multi-route, multi-hop routing engine that seeks the best price for users on every swap. As well, the router supports complexPath functions, which return percentages of different tokens equalling 100%, and recovery functions that return mistakenly sent tokens.

# Pool Types 

https://github.com/sushiswap/trident/tree/master/contracts/pool

Below are descriptions of Trident's different pool types, and the Trident ERC20 contract. Under each header below, there are links to the repo for the pool factory as well as the pool itself. All of the contracts for the contracts below can be found by following the link above.

## Constant Product

Pool: https://github.com/sushiswap/trident/blob/master/contracts/pool/ConstantProductPool.sol  
Factory: https://github.com/sushiswap/trident/blob/master/contracts/pool/ConstantProductPoolFactory.sol

Constant pools are the pool type that users are most familiar with. They are the most “unbiased” automated market maker, as well as the AMM used in SushiSwap V1. They’re sometimes referred to as “lazy LPs” or “Classic LPs” Constant Product pools are composed 50% of one token and 50% of another. 

## Hybrid Pool

Pool: https://github.com/sushiswap/trident/blob/master/contracts/pool/HybridPool.sol   
Factory: https://github.com/sushiswap/trident/blob/master/contracts/pool/HybridPoolFactory.sol

Hybrid pools can be made of any percentage of two tokens equalling 100. As a result, when users make swaps in a Hybrid pool, the pool distributes the price impact across the two tokens according to the token weights, rather than distributing price impact across all tokens indifferently like the Constant Product pools do. In a Hybrid pool, the token with a larger percentage, the price impact will be lower because the impact distributes evenly across more tokens. Conversely, the token with the smaller percentage of the pool will have a higher price impact, because it distributes across fewer tokens.
 
## Index Pool

Pool: https://github.com/sushiswap/trident/blob/master/contracts/pool/IndexPool.sol  
Factory: https://github.com/sushiswap/trident/blob/master/contracts/pool/IndexPoolFactory.sol

Index pools are pools that can have many different tokens, usually all of similar price ranges. These are usually stable coins, or other “like-kind” tokens, such as ETH and stETH, or USDC and USDT. The assets available in each pool are ultimately decided by the pool creator. The percentage of tokens in the Index pool is balanced equally among every token. So, if the pool creator makes a pool of four tokens, each token will have 25% of the pool; five tokens, each token will have 20% of the pool; and so on. The benefit of these pools is that they allow users to use a stableswap curve with reduced price impacts. 

## TridentERC20.sol

https://github.com/sushiswap/trident/blob/master/contracts/pool/TridentERC20.sol

Below is a description of the Trident pool ERC20, which is a smart contract that can be found by following the link above.

The Trident ERC20 contract supports fundamental ERC20 functions like approve, transfer, transferFrom, permit, mint and burn. It also has support for the EIP-2612 extension, which optimizes for gasless approvals.
