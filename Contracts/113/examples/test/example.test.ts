/* eslint-disable prefer-const */
import { ethers, network, deployments, getNamedAccounts, artifacts } from "hardhat";
import { expect } from "chai";
import { BigNumberish } from "ethers";

import { advanceTime, getBigNumber, impersonate } from "../../utilities";
import { Cauldron } from "../../typechain";

const maybe = (process.env.ETHEREUM_RPC_URL || process.env.INFURA_API_KEY) ? describe : describe.skip;

maybe("Test Example", async () => {
  let snapshotId;
  let Cauldron: Cauldron;
  let deployerSigner;

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.ETHEREUM_RPC_URL || `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
            blockNumber: 13430664,
          },
        },
      ],
    })

    await deployments.fixture(['Cauldron']);
    const {deployer} = await getNamedAccounts();
    deployerSigner = await ethers.getSigner(deployer);
    
    Cauldron = await ethers.getContract<Cauldron>("Cauldron");

    // More operations here...

    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await network.provider.send('evm_revert', [snapshotId]);
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  })

  it("should ...", async() => {
    console.log(Cauldron.address);
  });
});
