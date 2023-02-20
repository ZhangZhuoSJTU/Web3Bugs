import ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { task } from "hardhat/config";

import {
  USDC_ADDRESS_POLYGON,
  USDC_TOKEN_DECIMALS,
  MATIC_HOLDER_ADDRESS_POLYGON,
  USDC_HOLDER_ADDRESS_POLYGON,
} from "../../Constants";

import { action, success } from "../../helpers";

export default task("fork:distribute", "Distribute Ether and USDC").setAction(
  async (taskArguments, hre) => {
    action("Distributing Ether and USDC...");

    const { ethers } = hre;
    const { provider, getContractAt, getSigners } = ethers;
    const [deployer, wallet2] = await getSigners();

    const ethHolder = provider.getUncheckedSigner(MATIC_HOLDER_ADDRESS_POLYGON);
    const usdcHolder = provider.getUncheckedSigner(USDC_HOLDER_ADDRESS_POLYGON);

    const usdcContract = await getContractAt(ERC20.abi, USDC_ADDRESS_POLYGON, usdcHolder);

    const recipients: { [key: string]: string } = {
      ["Deployer"]: deployer.address,
      ["Wallet 2"]: wallet2.address,
    };

    const keys = Object.keys(recipients);

    for (var i = 0; i < keys.length; i++) {
      const name = keys[i];
      const address = recipients[name];

      action(`Sending 1000 Matic to ${name}...`);
      await ethHolder.sendTransaction({
        to: address,
        value: ethers.utils.parseEther("1000"),
      });

      action(`Sending 1000 USDC to ${name}...`);
      await usdcContract.transfer(address, ethers.utils.parseUnits("1000", USDC_TOKEN_DECIMALS));
    }

    success("Done!");
  }
);
