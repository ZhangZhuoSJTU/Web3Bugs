# SuperVaults POC

SuperVaults expand the capabilities of `VaultsCore` to integrate with DeFi aggregators and lending protocols to do things like: 
- Enter leveraged positions on collateral
- Rebalance vaults to use different collaterals 
- Pay off debt from vaults without any additional required capital


SuperVaults accomplish this by being an intermediary to automate on-chain transactions that need to be done by smart contracts. Thus, vault operations aren't done on SuperVault contracts themselves, but on the main `VaultsCore` contract. The same SuperVault can be used with multiple collateral types.


## Testing
To run all tests in the test suite, including both the integration tests and the unit tests, use: 
```
yarn full-test
```
### Unit Tests
The unit tests run on the hardhat network and mock the MIMO protocol. 
To run only the unit tests, use: 
```
yarn test
```
### Integration Tests
The integration tests run on a Polygon fork and thus use the actual Polygon deployed mimo and aggregator contracts without requiring any funds. 

Note: Running the integration tests usually takes ~ a minute for each test to run since they run on a forked network

To run only the integration tests, use:
```
yarn integration-test
```


## Deploying 
This repo is setup with `hardhat-deploy`. The `deployments/polygon` folder contains the currently deployed base `SuperVault` and `SuperVaultFactory` contracts. Note: Each clone must be made for each user so the clone contract isn't included in this repo but can be deployed by following the steps in the next section 

### Deploying a new `SuperVault` Clone 
To deploy a new `SuperVault` clone on polygon, make sure the `PRIVATE_KEY` variable is correctly set in the `.env`, and run:

```
yarn hardhat deploy --tags SuperVaultClone --network polygon 
```

This script assumes that the sender will be the owner. To deploy a clone on someone else's behalf, the `owner` argument needs to be changed in the `superVaultData` variable in `02_deploy_SuperVaultClone.ts`.

### Deploying a new Base `SuperVault` Instance
To deploy a new base `SuperVault` instance used by the `superVaultFactory`, use: 
```
yarn hardhat deploy --tags SuperVault --network polygon 
```
### Deploying a new `SuperVaultFactory` 
To deploy a new base `SuperVaultFactory` used to create `SuperVault` clones, use: 
```
yarn hardhat deploy --tags SuperVaultFactory --network polygon 
```

### Deploying All `SuperVault` Related Contracts: 
To deploy a fresh copy of all contracts (i.e. the base `SuperVault` , `SuperVaultFactory` and `SuperVault` clone), use:
```
yarn run deploy
```

## Verifying 
To verify contracts, make sure that the `ETHERSCAN_API_KEY` variable is set in `.env`, then run `yarn hardhat run scripts/verifyDeployments.ts` 

Note: Even when verifying on Polygonscan, set the `ETHERSCAN_API_KEY` variable in the `.env`.

Note: Cloned `SuperVault` instances are automatically verified by block explorers if the base `SuperVault` contract used to make the clone is verified. 

## Deployments


| Contract | Explorer |
| ------------------------- | --------------------------------------------------------------------------------------- |
| SuperVault| https://polygonscan.com/address/0x1A56b4a16Ac1f7a04c677B549B64f90563d7CC00#code |
| SuperVaultFactory |https://polygonscan.com/address/0x768d09090d98451C7e4CB9BF3B6D5433C754396a#code |

