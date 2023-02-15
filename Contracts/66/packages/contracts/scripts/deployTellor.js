async function main() {
  // We get the contract to deploy
  const toBigNum = ethers.BigNumber.from;
  const basefee = await ethers.provider.getGasPrice();
  const gasPrice = toBigNum(basefee).add(toBigNum('10000000000')) // add tip
  console.log(`BWB gasPrice is ${gasPrice}`);
  const Tellor = await ethers.getContractFactory("TellorDummy");
  const tellor = await Tellor.deploy({gasPrice: gasPrice});

  console.log("TellorDummy deployed to:", tellor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
