import { deployments, ethers } from "hardhat";

import { BigNumber } from "ethers";

const { deploy } = deployments;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default {
  async deployContract(contract, deployer, args = []) {
    const { address } = await deploy(contract, {
      from: deployer,
      args,
      log: true,
      deterministicDeployment: false,
    });

    return address;
  },

  async deployAccessControls(deployer) {
    const { address } = await deploy("MISOAccessControls", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const accessControl = await ethers.getContractAt(
      "MISOAccessControls",
      address
    );

    await (
      await accessControl.initAccessControls(deployer, {
        from: deployer,
      })
    ).wait();

    return address;

    // try {
    //   return (await deployments.get("MISOAccessControls")).address;
    // } catch (e) {
    //   const { address } = await deploy("MISOAccessControls", {
    //     from: deployer,
    //     log: true,
    //     deterministicDeployment: false,
    //   });

    //   const accessControl = await ethers.getContractAt(
    //     "MISOAccessControls",
    //     address
    //   );

    //   //   if (!(await accessControl.hasAdminRole(deployer))) {

    //   //   }

    //   await (
    //     await accessControl.initAccessControls(deployer, {
    //       from: deployer,
    //     })
    //   ).wait();

    //   return address;
    // }
  },

  async deployTokenFactory(accessControl, deployer) {
    const { address } = await deploy("MISOTokenFactory", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const misoTokenFactory = await ethers.getContractAt(
      "MISOTokenFactory",
      address
    );

    const _accessControls = await misoTokenFactory.accessControls();

    if (_accessControls === ZERO_ADDRESS) {
      await (
        await misoTokenFactory.initMISOTokenFactory(accessControl, {
          from: deployer,
        })
      ).wait();
    }
    return address;
  },

  async deployMisoMarket(accessControl, bentoBox, templates, deployer) {
    const { address } = await deploy("MISOMarket", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const misoMarket = await ethers.getContractAt("MISOMarket", address);
    const templateId: BigNumber = await misoMarket.auctionTemplateId();

    if (templateId.toNumber() === 0) {
      await (
        await misoMarket.initMISOMarket(accessControl, bentoBox, templates, {
          from: deployer,
        })
      ).wait();
    }

    return address;
  },

  async deployPointListFactory(
    pointList,
    accessControl,
    pointListFee,
    deployer
  ) {
    const { address } = await deploy("ListFactory", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const pointListFactory = await ethers.getContractAt("ListFactory", address);
    const _accessControls = await pointListFactory.accessControls();

    if (_accessControls === ZERO_ADDRESS) {
      await (
        await pointListFactory.initListFactory(
          accessControl,
          pointList,
          pointListFee,
          { from: deployer }
        )
      ).wait();
    }

    return address;
  },

  async deployMisoLauncher(accessControl, wethAddress, bentoBox, deployer) {
    const { address } = await deploy("MISOLauncher", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const misoLauncher = await ethers.getContractAt("MISOLauncher", address);
    const _accessControls = await misoLauncher.accessControls();

    if (_accessControls === ZERO_ADDRESS) {
      await (
        await misoLauncher.initMISOLauncher(
          accessControl,
          wethAddress,
          bentoBox,
          { from: deployer }
        )
      ).wait();
    }

    return address;
  },

  async deployFarmFactory(
    accessControl,
    misoDev,
    minimumFee,
    tokenFee,
    deployer
  ) {
    const { address } = await deploy("MISOFarmFactory", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
    });

    const farmFactory = await ethers.getContractAt("MISOFarmFactory", address);
    const _accessControls = await farmFactory.accessControls();

    if (_accessControls === ZERO_ADDRESS) {
      await (
        await farmFactory.initMISOFarmFactory(
          accessControl,
          misoDev,
          minimumFee,
          tokenFee,
          { from: deployer }
        )
      ).wait();
    }

    return address;
  },

  async deployMisoHelper(
    accessControls,
    tokenFactoryAddress,
    marketAddress,
    launcherAddress,
    farmFactoryAddress,
    deployer
  ) {
    const { address } = await deploy("MISOHelper", {
      from: deployer,
      args: [
        accessControls,
        tokenFactoryAddress,
        marketAddress,
        launcherAddress,
        farmFactoryAddress,
      ],
      log: true,
      deterministicDeployment: false,
    });

    return address;
  },
};
