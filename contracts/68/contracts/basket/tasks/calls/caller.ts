import { task } from "hardhat/config";

import { IExperiPie } from "../../typechain/IExperiPie";

import "@nomiclabs/hardhat-ethers";
import { IExperiPie__factory } from "../../typechain";

task("add-caller-to-basket", "Adds a caller (Manager) to the pie")
  .addParam("caller", "The caller address to add")
  .addParam("basket", "The basket address")
  .setAction(async (taskArgs, { ethers, run }) => {
  

    const pie = (await ethers.getContractAt(
      "IExperiPie",
      taskArgs.basket
    )) as IExperiPie;
    await (await pie.addCaller(taskArgs.caller)).wait(1);
  });

task("remove-caller-from-basket", "Adds a caller (Manager) to the pie")
  .addParam("caller", "The caller address to remove")
  .addParam("basket", "The basket address")
  .setAction(async (taskArgs, { ethers, run }) => {
  

    const pie = (await ethers.getContractAt(
      "IExperiPie",
      taskArgs.basket
    )) as IExperiPie;
    await (await pie.removeCaller(taskArgs.caller)).wait(1);
  });


task("execute-calls")
.addParam("pie", "address of the pie")
.addParam("input", "calls.json", "./call.json")
.setAction(async (taskArgs, { ethers, run }) => {


  const signers = await ethers.getSigners();

  const account = await signers[0].getAddress();

  const pie = IExperiPie__factory.connect(taskArgs.pie, signers[0]);

  const calls = require(taskArgs.input);

  const targets: string[] = calls.map((item) => item.target);
  const data: string[] = calls.map((item) => item.data);
  const values: string[] = calls.map((item) => item.value);

  const tx = await pie.call(targets, data, values);

  console.log("Calls send tx id:", tx.hash);
});