const erc20abi = require("../abis/erc20.json");

const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { BigNumber } = require("ethers");

const OWNER = "0x8D1f2eBFACCf1136dB76FDD1b86f1deDE2D23852";
const VALIDATOR_1 = "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2";
const VALIDATOR_2 = "0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b";
const OPERATOR_1 = "0x294E938cfe8e5769BB507788d743b59112Adec7A";
const OPERATOR_2 = "0x6254B927ecC25DDd233aAECD5296D746B1C006B4";
const DELEGATOR_1 = "0xb270FC573F9f9868ab11B52AE7119120f6a4471d";
const DELEGATOR_2 = "0xa56B1B002814Ac493A6DAb5A72d30996B6A9Fe4d";
const CQT = "0xD417144312DbF50465b1C641d016962017Ef6240";

const testAccountAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const testAccountKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

async function impersonateAll(){
    // owner
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [OWNER],
    });
    // validator 1
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [VALIDATOR_1],
    });

    // validator 2
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [VALIDATOR_2],
    });

    // delegator 1
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DELEGATOR_1],
    });

    // delegator 2
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [DELEGATOR_2],
    })
}

async function mineBlocks(n){
    let i = 0
      while (i< n){
        await hre.network.provider.send("evm_mine");
        i = i + 1;
      }
}
async function getOwner(){
    return await ethers.getSigner(OWNER);
}

async function getValidator1(){
    return await ethers.getSigner(VALIDATOR_1);
}
async function getValidator2(){
  return await ethers.getSigner(VALIDATOR_2);
}
async function getOperator1(){
  return await ethers.getSigner(OPERATOR_1);
}
async function getOperator2(){
  return await ethers.getSigner(OPERATOR_2);
}
async function getDelegator1(){
  return await ethers.getSigner(DELEGATOR_1);
}
async function getDelegator2(){
  return await ethers.getSigner(DELEGATOR_2);
}

async function getTestAccount(){
  return await ethers.getSigner(testAccountAddress);
}

async function getCqtContract(){
    return new ethers.Contract( CQT , erc20abi , await getOwner());
}

async function getDeployedContract(){

    await impersonateAll();
    const owner = await getOwner();
    const DelegatedStaking = await ethers.getContractFactory("DelegatedStaking", owner);
    const contract = await DelegatedStaking.deploy();
    await contract.deployed();
    console.log("Staking contract address is: ", contract.address)

    return contract;
}

async function deposit(contract, amount){
    const cqtContract = await getCqtContract();
    await cqtContract.approve(contract.address, amount);
    //contract.setAllocatedTokensPerEpoch(100);
    await contract.depositRewardTokens(amount);
  }

async function stake(amount, signer, cqtContract, contract, id){
  await cqtContract.connect(signer).approve(contract.address, amount);
  return await contract.connect(signer).stake(id, amount);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

async function main() {
    const cqtContract = await getCqtContract();
    const contract = await getDeployedContract()
    const testAccount = await getTestAccount()
    const delegator1 = await getDelegator1();
    await cqtContract.connect(delegator1).transfer(testAccountAddress, "100000000000000000000000")
    await deposit(contract, "1000000000000000000000000")
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)//^17)
    await contract.addValidator(VALIDATOR_2, OPERATOR_2, 50000000000)//^17)

    const validator1 = await getValidator1();
    const validator2 = await getValidator2();

    await stake("10000000000000000000", validator1, cqtContract, contract, 0)
    await stake("890000000000000000000", validator2, cqtContract, contract, 1)

    await stake("100000000000000000000", delegator1, cqtContract, contract, 0)
    mineBlocks(1000)
    //const check = await contract.getValidatorsDetails();
    const delegator2 = await getDelegator2();
    await stake("100000000000000000000", delegator1, cqtContract, contract, 1)
    mineBlocks(1000)
    await stake("100000000000000000000", delegator1, cqtContract, contract, 1)

    while (true){
        await hre.network.provider.send("evm_mine");
        await sleep(10000);
    }

  }


  main()
    // .then(() => process.exit(0))
    // .catch((error) => {
    //   console.error(error);
    //   process.exit(1);
    // });