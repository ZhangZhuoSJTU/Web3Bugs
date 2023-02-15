import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, network } from "hardhat";
import { BentoBoxMock } from "../typechain";
import { ChainId } from "../utilities";
import { DeploymentSubmission } from "hardhat-deploy/dist/types";
import { expect } from "chai";

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const wethMock = await deploy("WETH9Mock", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });
  const bentoBoxMock = await deploy("BentoBoxMock", {
    from: deployer,
    args: [wethMock.address],
    log: true,
    deterministicDeployment: false,
  });
  const bentoBox = await ethers.getContractAt<BentoBoxMock>("BentoBoxMock", bentoBoxMock.address);

  // Master contract
  const nftPairMock = await deploy("NFTPairMock", {
    contract: "NFTPair",
    from: deployer,
    args: [bentoBoxMock.address],
    log: true,
    deterministicDeployment: false,
  });

  // Mock tokens
  const apesMock = await deploy("ApesNFTMock", {
    contract: "ERC721Mock",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });
  const bearsMock = await deploy("BearsNFTMock", {
    contract: "ERC721Mock",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });
  const MaxUint128 = ethers.BigNumber.from(2).pow(128).sub(1);
  const guineasMock = await deploy("GuineasMock", {
    contract: "ERC20Mock",
    from: deployer,
    args: [MaxUint128],
    log: true,
    deterministicDeployment: false,
  });

  const freeMoneyMock = await deploy("FreeMoneyMock", {
    contract: "FreelyMintableERC20Mock",
    from: deployer,
    args: [MaxUint128],
    log: true,
    deterministicDeployment: false,
  });

  await bentoBox.whitelistMasterContract(nftPairMock.address, true);

  // Pairs - deployed by BentoBox:
  const bentoDeploy = async (name, masterAddress, initData) => {
    try {
      await deployments.get(name);
      return;
    } catch {}
    const deployTx = await bentoBox.deploy(masterAddress, initData, true).then((tx) => tx.wait());
    for (const e of deployTx.events || []) {
      if (e.eventSignature == "LogDeploy(address,bytes,address)") {
        await deployments.save(name, {
          abi: [],
          address: e.args?.cloneAddress,
        });
      }
      return;
    }
    throw new Error("Failed to either find or execute deployment");
  };
  const deployPair = (name, collateral, asset) =>
    bentoDeploy(name, nftPairMock.address, ethers.utils.defaultAbiCoder.encode(["address", "address"], [collateral.address, asset.address]));

  await deployPair("ApesGuineasNFTPairMock", apesMock, guineasMock);
  await deployPair("ApesWethNFTPairMock", apesMock, wethMock);
  await deployPair("BearsGuineasNFTPairMock", bearsMock, guineasMock);

  await deployPair("ApesFreeMoneyNFTPairMock", apesMock, freeMoneyMock);
  await deployPair("BearsFreeMoneyNFTPairMock", bearsMock, freeMoneyMock);
};

export default deployFunction;

const testChainIds = [ChainId.Ropsten, ChainId.Rinkeby, ChainId.Goerli, ChainId.Kovan, ChainId.BSCTestnet, ChainId.Localhost, ChainId.Hardhat];

if (network.name !== "hardhat" || process.env.HARDHAT_LOCAL_NODE) {
  deployFunction.skip = ({ getChainId }) =>
    new Promise((resolve, reject) => {
      try {
        getChainId().then((chainId) => {
          resolve(!testChainIds.includes(parseInt(chainId, 10)));
        });
      } catch (error) {
        reject(error);
      }
    });
}

deployFunction.tags = ["NFTPair"];
deployFunction.dependencies = [];
