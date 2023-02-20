import { task } from "hardhat/config";
import { utils, Contract, BigNumber } from "ethers";
import * as fs from "fs";

task("test_bug", "Playground for testing bugs")
  .setAction(async ({ amount }, { ethers, network }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }

    // const artifactFile = '/home/adrian/code/defi/TaoDAO-0.1/TaoStaking.json';

    // if (!fs.existsSync(artifactFile)) {
    //   console.error("You need to deploy your contract first");
    //   return;
    // }

    // const artifactJson = fs.readFileSync(artifactFile);
    // const artifacts = JSON.parse(artifactJson.toString());

    // if ((await ethers.provider.getCode(artifacts.address)) === "0x") {
    //   console.error("You need to deploy your contract first");
    //   return;
    // }

    // const [sender] = await ethers.getSigners();
    // const senderAddress = await sender.getAddress();

    const lpmine = await ethers.getContractAt("LiquidityMine", "0x59b670e9fA9D0A427751Af201D676719a970857b");

    const tx = await lpmine.initialize(
      "MALT/BUSD",
      "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      "0xb635c4e5ba0c18f7376e0d738b76be464b08e3bd",
      "0x9c185D0c1F741A8F3dCD77cEB64e54d9b37Afd86",
      48,
      1621611000,
      "0xe01868cb8a025a6fa5e87c4e885362b4e16ac961",
      "0xDe11F05B67f95fAeDbEB68050C2a9af2Ae62Abe2",
      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F"
    );
    await tx.wait();
    console.log(1);
















    // const taoStaking = new Contract(artifacts.address, artifacts.abi, sender);

    // const provider = ethers.getDefaultProvider();


    // const val = await provider.getStorageAt(artifacts.address, '0x0');
    // console.log(val);

    // const len = await taoStaking.epochLengthInBlocks();
    // console.log('LEN', len.toString());

    // let count = 0;
    // while (true) {
    //   let val = await provider.getStorageAt(artifacts.address, `0x${count.toString(16)}`);

    //   console.log(count, val.toString());

    //   if (val === len) {
    //     break
    //   }
    //   count++;
    // }















    // const val = await provider.getStorageAt('0x8a1DB6504e3983D8559dd3482500Dec881350ae1', '0x98461998b3d545d74e65ce2d8a17005dd2748e503a0b31a2fdacc100600d7dba');
    // console.log(val);

    // const epochBondsMappingSlot = "0x575cb4bebb65e1c71cc08b64c748ab2729a9c15cacde74e584a040fcfff12f93"
    // const epochUnbondsMappingSlot = "0x575cb4bebb65e1c71cc08b64c748ab2729a9c15cacde74e584a040fcfff12f94"
    // const epochWithdrawsMappingSlot = "0x575cb4bebb65e1c71cc08b64c748ab2729a9c15cacde74e584a040fcfff12f95"

    // async function getEpochBond(epoch: number) {
    //   const args = utils.solidityKeccak256(["uint256", "uint256"], [ epoch, epochBondsMappingSlot ]);

    //   const val = await network.provider.request({
    //     method: "eth_getStorageAt",
    //     params: [lpmine.address, args, "latest"]}
    //   )
    //   return BigNumber.from(val);
    // }

    // async function getEpochUnbond(epoch: number) {
    //   const args = utils.solidityKeccak256(["uint256", "uint256"], [ epoch, epochUnbondsMappingSlot ]);

    //   const val = await network.provider.request({
    //     method: "eth_getStorageAt",
    //     params: [lpmine.address, args, "latest"]}
    //   )
    //   return BigNumber.from(val);
    // }

    // async function getEpochWithdraw(epoch: number) {
    //   const args = utils.solidityKeccak256(["uint256", "uint256"], [ epoch, epochWithdrawsMappingSlot ]);

    //   const reward = await network.provider.request({
    //     method: "eth_getStorageAt",
    //     params: [lpmine.address, args, "latest"]}
    //   )
    //   const malt = await network.provider.request({
    //     method: "eth_getStorageAt",
    //     params: [lpmine.address, BigNumber.from(args).add(1).toHexString(), "latest"]}
    //   )

    //   return [BigNumber.from(reward), BigNumber.from(malt)];
    // }
    // console.log((await dao.getEpochStartTime(38)).toString());

    // const bondedEpoch = 14;
    // const currentEpoch = 443;

    // let totalReward = 0;
    // let unlockedReward = 0;
    // let totalMalt = 0;
    // let unlockedMalt = 0;
    // let userBondedTotal = 293.12795475690179633;

    // for (let i = bondedEpoch; i < currentEpoch; i++) {
    //   let epochOwnership = 0;
    //   const epochBonded = await lpmine.totalBondedAtEpoch(i);




    //   const withdraw = await getEpochWithdraw(i);
      // console.log(i, v.toString());
    // }















    // const val2 = await lpmine.balanceOfMaltStakePadding(address);
    // console.log(val2);

    // stake padding is a clue. 
    // It is changed during withdraw and it is a free variable in the userState struct

    // TODO abtract away the above Wed 24 Mar 2021 02:54:02 GMT
    // Write functions that will allow me access to the inner workings for the userState struct
    // console.log(val);

    // await network.provider.request({
    //   method: "hardhat_impersonateAccount",
    //   params: ["0x8a1DB6504e3983D8559dd3482500Dec881350ae1"]}
    // )
    // const lpmineSigner = await ethers.provider.getSigner("0x8a1DB6504e3983D8559dd3482500Dec881350ae1")
  
    // const address = '0xc3297093659a58aa281d4c9577664244ac2bcc94'
    // const address = '0x9935d59c99416993e7b1d385fd2385383989512b'

    // const [malt, dai] = await lpmine.earned(address);
    // console.log(`Earned: ${utils.commify(utils.formatEther(dai))} ${utils.commify(utils.formatEther(malt))}`);

    // const [malt, dai] = await lpmine.getUnlockedPercentage(address);
    // console.log(`Unlocked %: ${dai.toString()} ${malt.toString()}`);

    // _updateBond and withdraw methods both update epochWithdraws
    // Seems zhanet called both methods in same epoch and that is causing issues
    // Is it possible she withdrew more than allowed because same epoch?
    //
    // When withdraw should stake padding be updated? Is it?
    //
    // The following are both called during withdraw. SHould they be called for reinvest?
    // _declaredBalance = _declaredBalance.sub(rewardAmount);
    // _declaredMaltBalance = _declaredMaltBalance.sub(maltAmount);



    // TODO set up scenario locally where compoundReinvest is called then withdraw called immediately after Wed 24 Mar 2021 01:54:40 GMT













    // console.log(lpmine);
    // const userstate = await lpmine.userState(address);
    // console.log(userstate);

    // for (let i = bondedEpoch + 1; i < currentEpoch; i++) {
    //   console.log(epochBonded);

    // }

    // console.log(userstate.bondedEpoch.toString());
  });
