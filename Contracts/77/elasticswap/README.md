# ElasticSwap

The first automated market maker (AMM) with native support for tokens with elastic supply

# Run Tests
1. `yarn install`
2. `yarn test`

# Coverage
1. `yarn coverage`

# Deployments (on testnet)
1. Update hardhat.config.json with needed credentials
1. `npx hardhat deploy --network goerli --export-all ./artifacts/deployments.json`
1. Verify on etherscan `npx hardhat --network goerli etherscan-verify --api-key <APIKEY>`
