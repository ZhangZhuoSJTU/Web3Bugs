require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});


 module.exports = {
    solidity: {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true
          }
        }
      }
}
