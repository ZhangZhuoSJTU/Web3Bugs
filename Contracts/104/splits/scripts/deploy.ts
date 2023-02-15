import { ethers, waffle } from "hardhat";
import fs from "fs";
const hre = require("hardhat");

const { formatContract, writeToJson } = require("./utils/generate");

const config = {
  mainnet: {
    WETH_ADDRESS: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  },
  rinkeby: {
    WETH_ADDRESS: "0xc778417e063141139fce010982780140aa0cd5ab",
  },
  polygonMumbai: {
    //TST ERC20 Token on testnet
    WETH_ADDRESS: "0x2d7882bedcbfddce29ba99965dd3cdf7fcb10a1e",
  },
  hardhat: {
    // Note: This won't integrate, but will allow us to test deploys.
    WETH_ADDRESS: "0xc778417e063141139fce010982780140aa0cd5ab",
  },
};

const NETWORK_MAP = {
  "1": "mainnet",
  "4": "rinkeby",
  "1337": "hardhat",
  "31337": "hardhat",
  "80001": "polygonMumbai",
};

let isLocal = false;

async function main() {
  const chainId = (await waffle.provider.getNetwork()).chainId;

  console.log({chainId})
  const networkName = NETWORK_MAP[chainId];

  console.log(`Deploying to ${networkName}`);

  const { WETH_ADDRESS } = config[networkName];


  const MyNft = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNft.deploy();
  await myNFT.deployed();

  const Splitter = await ethers.getContractFactory("Splitter");
  const splitter = await Splitter.deploy();
  await splitter.deployed();


  const SplitFactory = await ethers.getContractFactory("SplitFactory");
  const splitFactory = await SplitFactory.deploy(
    splitter.address,
    WETH_ADDRESS
  );
  await splitFactory.deployed();

  // copying abis and contract address => networks
  const contracts = ["Splitter", "SplitFactory"];
  const addresses = [
    splitter.address,
    splitFactory.address,
  ];

  const content = contracts.reduce((value, contract, index) => {
    return {
      ...value,
      ...formatContract(contract, addresses[index]),
    };
  }, {});

  writeToJson(chainId, content);

  setTimeout(async ()=>{
    await hre.run("verify:verify", {
      address: myNFT.address,
      constructorArguments: [],
    });
    
    await hre.run("verify:verify", {
      address: splitter.address,
      constructorArguments: [],
    });
  
    await hre.run("verify:verify", {
      address: splitFactory.address,
      constructorArguments: [
        splitter.address,
        WETH_ADDRESS
      ],
    });
  
  }, 10000);

  
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
