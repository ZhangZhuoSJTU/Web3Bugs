const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const USAGE = "USAGE: serializeDeployment.js NETWORK_OUTPUT.json"

const deployment = {
  "bootstrapPeriod": 1209600,
  "totalStabilityPoolYETIReward": "50000000",
  "liquidityMiningYETIRewardRate": "0.257201646090534979",
  "tjLiquidityMiningYETIRewardRate": "0",
  "pngLiquidityMiningYETIRewardRate": "0.41335978835978837",
  "_priceFeedIsTestnet": false,
  "_uniTokenIsMock": false,
  "_isDev": false,
  "addresses": {}
};

async function main() {
    const outputFile = process.argv[2];
    if (!outputFile) {
        throw new Error(USAGE);
    }

    const params = JSON.parse(fs.readFileSync(outputFile))
    //console.log(params)
    const depFile = path.resolve(`${__dirname}/../../lib-ethers/deployments/default/${params.metadata.network.name}.json`);
    deployment.chainId = params.metadata.network.chainId;
    deployment.startBlock = params.metadata.startBlock;
    deployment.deploymentDate = params.metadata.deploymentDate;
    for (const k of Object.keys(params)) {
        if (k === 'metadata' || k[0] === k[0].toUpperCase() || k === 'tellorCaller') {
            continue;
        }
        deployment.addresses[k] = params[k].address;
    }
    
    // the version is the git commit
    const version = execSync('git rev-parse HEAD').toString().trimRight();
    deployment.version = version;
    fs.writeFileSync(depFile, JSON.stringify(deployment, null, 4));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

