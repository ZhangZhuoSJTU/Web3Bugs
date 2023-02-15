#!/bin/bash
echo -e "Deploying L1 Token and Escrow"
npx hardhat deploy --tags L1_ESCROW --network rinkeby

echo -e "Deploying L2 Token"
npx hardhat deploy --tags L2_TOKEN --network arbitrumRinkeby

echo -e "\n Deploying L1 Bridge"
npx hardhat deploy --tags L1_GATEWAY --network rinkeby

echo -e "\n Deploying L2 Bridge"
npx hardhat deploy --tags L2_GATEWAY --network arbitrumRinkeby

echo -e "\n Deploying L2 Migrator"
npx hardhat deploy --tags L2_MIGRATOR --network arbitrumRinkeby

echo -e "\n Deploying L1 Migrator"
npx hardhat deploy --tags L1_MIGRATOR --network rinkeby

echo -e "\n Initialize L1 Bridge"
npx hardhat deploy --tags L1_GATEWAY_INIT --network rinkeby

echo -e "\n Initialize L2 Bridge"
npx hardhat deploy --tags L2_GATEWAY_INIT --network arbitrumRinkeby
