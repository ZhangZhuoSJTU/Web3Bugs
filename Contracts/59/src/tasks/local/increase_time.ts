import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("increase_time", "Moves time forward")
  .addPositionalParam("minutes", "The number of minutes to move forward")
  .setAction(async ({ minutes }, { ethers, network }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }


    await ethers.provider.send('evm_increaseTime', [60 * minutes]);
    await ethers.provider.send('evm_mine', []);
  });
