import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";

const mnemonic = "eight fun oak spot hip pencil matter domain bright fiscal nurse easy";

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  const wallet = hre.ethers.Wallet.fromMnemonic(mnemonic);
  console.log(wallet.privateKey);
});

export default {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic,
      },
    },
    ropsten: {
      url: `https://nd-564-762-624.p2pify.com/41adb4b5065ff74a971a8bf5e85947c7`,
      chainId: 3,
      accounts: {
        mnemonic,
      },
      from: "0xD8d8632Bb8C8b199e43faDf7205749dd34C4B8c9", 
      gaslLimit: "2000000",
      gasMultiplier:1.4
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 50000,
  },
};
