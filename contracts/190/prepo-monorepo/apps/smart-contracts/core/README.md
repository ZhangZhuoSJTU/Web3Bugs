# prePO Core Smart Contracts

This repository contains all the core smart contracts for prePO V1.

### General smart contract readme

See [../README.md](../README.md) in the parent directory.

## Deploy

### Deploy Locally

Because our scripts use `hardhat-upgrades` to deploy our upgradeable contracts, they are not managed by `hardhat-deploy`.  
Upgradeable deployment addresses are kept track of separately in a local `.env` file.

`hardhat-deploy` will automatically call deployment scripts for any dependencies of a specified `tag`.  
Per the tag dependency tree below, specifying `PrePOMarketFactory` under `--tags`, will deploy the entire PrePO core stack.  
A mock strategy can be deployed as well for testing purposes with the `MockStrategy` tag.

     CollateralDepositRecord   AccountAccessController
         ^              ^                  ^
         |              |                  |
         |              |                  |
    WithdrawHook   DepositHook-------------+              SingleStrategyController   BaseToken
         ^              ^                                             ^                  ^
         |              |                                             |                  |
         |              |                                             |                  |
         +--------------+-----------------------Collateral------------+------------------+
                                                    ^
                                                    |
                                                    |
                                          +---------+---------+
                                          |                   |
                                          |                   |
                                          |                   |
                                 PrePOMarketFactory     MockStrategy
                                                         (optional)