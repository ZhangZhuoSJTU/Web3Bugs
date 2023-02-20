import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "hardhat-typechain";
import { task } from "hardhat/config";

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// // This is a sample Buidler task. To learn how to create your own go to
// // https://buidler.dev/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (taskArgs, bre) => {
//   const accounts = await bre.ethers.getSigners();

//   for (const account of accounts) {
//     console.log(await account.getAddress());
//   }
// });

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  solidity: {
    version: "0.6.6",
    settings: {
      optimizer: {
        enabled: true
      }
    }  },
  networks: {
    hardhat: {
      timeout: 2000000,
      accounts: [
        {
          privateKey:
            "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x275cc4a2bfd4f612625204a20a2280ab53a6da2d14860c47a9f5affe58ad86d4",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x7f307c41137d1ed409f0a7b028f6c7596f12734b1d289b58099b99d60a96efff",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2a8aede924268f84156a00761de73998dac7bf703408754b776ff3f873bcec60",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x8b24fd94f1ce869d81a34b95351e7f97b2cd88a891d5c00abc33d0ec9501902e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29085",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29086",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29087",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29088",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29089",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf00",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf01",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf02",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf03",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf04",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf05",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf06",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf07",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf08",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf09",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf10",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf11",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf12",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf13",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf14",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf15",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf16",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf17",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf18",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf19",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf20",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf21",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf22",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf23",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf24",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf25",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf26",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf27",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf28",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf29",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf30",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf31",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf32",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf33",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf34",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf35",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf36",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf37",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf38",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf39",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf40",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf41",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf42",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf43",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf44",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf45",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf46",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf47",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf48",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf49",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf50",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf51",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf52",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf53",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf54",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf55",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf56",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf57",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf58",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf59",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb100",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb101",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb102",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb103",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb104",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb105",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb106",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb107",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb108",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb109",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb110",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb111",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb112",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb113",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb114",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb115",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb116",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb117",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb118",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb119",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11a",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11b",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11c",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11d",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11e",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11f",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb120",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb121",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb122",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb123",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb124",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb125",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb126",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb127",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb128",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb129",
          balance: "0xfffffffffffffffffffffff"
        },
        {
          privateKey:
            "0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7",
          balance: "0xfffffffffffffffffffffff"
        }
      ]
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
    runOnCompile: true
  },
  gasReporter: {
    enabled: true
  },
  mocha: {
    timeout: 2000000
  }
};
