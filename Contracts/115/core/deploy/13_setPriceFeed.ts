import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MAINNET_COLLATERAL_AGGREGATORS, NETWORK_CONFIG } from "../config/deployment";
import { EACProxyAggregatorAbi } from "../utils/abis/EACAggregatorProxy";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const [deployerSigner] = await hre.ethers.getSigners();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const ethereumProvider = hre.ethers.getDefaultProvider("mainnet", {
    infura: process.env.INFURA_TOKEN,
  });

  const collateralList = Object.keys(networkConfig.collaterals);

  console.log("Core - Setting PriceFeed");

  const priceFeedContract = await hre.ethers.getContract("PriceFeed", deployerSigner);
  let tx;
  let receipt;

  for (const element of collateralList) {
    let collateral = networkConfig.collaterals[element].address;
    let collateralAggregator = networkConfig.collaterals[element].usdAggregator;
    if ((!hre.network.live || networkConfig.isTestNet) && collateral === "") {
      const mockToken = await hre.deployments.get(`Mock${element}`);
      collateral = mockToken.address;
    }

    if (collateralAggregator === "") {
      const mainnetCollateralAggregator = new hre.ethers.Contract(
        MAINNET_COLLATERAL_AGGREGATORS[element],
        EACProxyAggregatorAbi,
        ethereumProvider,
      );
      const latestRoundData = await mainnetCollateralAggregator.latestRoundData();
      const collateralDecimals = await mainnetCollateralAggregator.decimals();
      const collateralStartPrice = latestRoundData.answer.toString();
      const mockAggregator = await deploy(`${element}UsdAggregator`, {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [collateralDecimals, collateralStartPrice, `${element} / USD`],
        log: true,
      });

      console.log(`MockChainlinkFeed for ${element} / USD:`, mockAggregator.address);
      collateralAggregator = mockAggregator.address;
    }

    tx = await priceFeedContract.setAssetOracle(collateral, collateralAggregator);
    receipt = await tx.wait(1);
    console.log(`Set ${element} Oracle (tx: ${receipt.transactionHash})`);
  }

  let { eurUsdAggregator } = networkConfig;
  if (eurUsdAggregator === "") {
    const chainlinkEurUsdAggregator = new hre.ethers.Contract(
      NETWORK_CONFIG[1].eurUsdAggregator,
      EACProxyAggregatorAbi,
      ethereumProvider,
    );
    const latestRoundData = await chainlinkEurUsdAggregator.latestRoundData();
    const EUR_START_PRICE = latestRoundData.answer.toString();

    const eurAggregator = await deploy("EurUsdAggregator", {
      from: deployer,
      contract: "MockChainlinkFeed",
      args: [8, EUR_START_PRICE, `EUR / USD`],
      log: true,
      skipIfAlreadyDeployed: true,
    });
    eurUsdAggregator = eurAggregator.address;
  }

  tx = await priceFeedContract.setEurOracle(eurUsdAggregator);
  receipt = await tx.wait(1);
  console.log(`Set EURUSD Oracle (tx: ${receipt.transactionHash})`);
};

export default func;
func.id = "set_price_feed";
func.dependencies = ["Core"];
func.tags = ["SetCore", "SetPriceFeed"];
