const erc20abi = require("../abis/erc20.json");

const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");
//const { BigNumber } = require("ethers");

const oneToken =  ethers.BigNumber.from("1000000000000000000");
const OWNER = "0x8D1f2eBFACCf1136dB76FDD1b86f1deDE2D23852";
const VALIDATOR_1 = "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2";
const VALIDATOR_2 = "0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b";
const OPERATOR_1 = "0x294E938cfe8e5769BB507788d743b59112Adec7A";
const OPERATOR_2 = "0x6254B927ecC25DDd233aAECD5296D746B1C006B4";
const DELEGATOR_1 = "0xb270FC573F9f9868ab11B52AE7119120f6a4471d";
const DELEGATOR_2 = "0xa56B1B002814Ac493A6DAb5A72d30996B6A9Fe4d";
const V3 = "0xd6216fc19db775df9774a6e33526131da7d19a2c"
const V4 = "0xf050257f16a466f7d3926a38e830589ab539ee88"
const CQT = "0xD417144312DbF50465b1C641d016962017Ef6240";
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
    // validator 3
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [V3],
  });

  // validator 4
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [V4],
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
    });
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
async function getValidator3(){
  return await ethers.getSigner(V3);
}
async function getValidator4(){
  return await ethers.getSigner(V4);
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

async function getCqtContract(){
    return new ethers.Contract( CQT , erc20abi , await getOwner());
}

async function getAll(){
  const contract = await getDeployedContract();
  const cqtContract = await getCqtContract();
  const validator1 = await getValidator1();
  const validator2 = await getValidator2();
  const delegator1 = await getDelegator1();
  const delegator2 = await getDelegator2();
  const v3 = await getValidator3()
  const v4 = await getValidator4()
  return [contract, cqtContract, validator1, validator2, delegator1, delegator2, v3, v4 ]
}
async function getMetadata(contract){
  const r = await contract.getMetadata();
  return r
}
async function getAllocatedTokensPerEpoch(contract){
  const r = await contract.getMetadata();
  return r[0]
}
async function getRewardsLocked(contract){
  const r = await contract.getMetadata();
  return r.rewardsLocked
}
async function getEndEpoch(contract){
  const r = await contract.getMetadata();
  return r[1]
}
async function getMaxCapMultiplier(contract){
  const r = await contract.getMetadata();
  return r[2]
}
async function getTotalStaked(contract){
  const r = await contract.getMetadata();
  return r[3]
}
async function getValidatorsN(contract){
  const r = await contract.getMetadata();
  return r[4]
}


async function getDeployedContract(){
    await impersonateAll();
    const owner = await getOwner();
    const DelegatedStaking = await ethers.getContractFactory("DelegatedStaking", owner);
    const contract = await upgrades.deployProxy(DelegatedStaking, [0], { initializer: 'initialize' });
    await contract.deployed();
    return contract;
}

async function deposit(contract, amount){
  const cqtContract = await getCqtContract();
  await cqtContract.approve(contract.address, amount);
  await contract.depositRewardTokens(amount);
}

async function stake(amount, signer, cqtContract, contract, id){
    await cqtContract.connect(signer).approve(contract.address, amount);
    return await contract.connect(signer).stake(id, amount);
}

exports.stake = stake;
exports.deposit = deposit;
exports.getAll = getAll;
exports.mineBlocks = mineBlocks;
exports.getOwner = getOwner;
exports.getDeployedContract = getDeployedContract;
exports.getMetadata = getMetadata;
exports.getAllocatedTokensPerEpoch = getAllocatedTokensPerEpoch;
exports.getRewardsLocked = getRewardsLocked;
exports.getEndEpoch = getEndEpoch;
exports.getMaxCapMultiplier = getMaxCapMultiplier;
exports.getTotalStaked = getTotalStaked;
exports.getValidatorsN = getValidatorsN;
exports.oneToken = oneToken;
exports.OWNER = OWNER;
exports.VALIDATOR_1 = VALIDATOR_1;
exports.VALIDATOR_2 = VALIDATOR_2;
exports.OPERATOR_1 = OPERATOR_1;
exports.OPERATOR_2 = OPERATOR_2;
exports.DELEGATOR_1 = DELEGATOR_1;
exports.DELEGATOR_2 = DELEGATOR_2;
exports.CQT = CQT;

