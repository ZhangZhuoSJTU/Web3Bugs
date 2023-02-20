const { mainnetDeploy } = require('./mainnetDeployment.js')
const configParams = require("./deploymentParams.rinkeby.js")

async function main() {
  await mainnetDeploy(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
