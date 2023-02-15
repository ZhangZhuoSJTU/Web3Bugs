async function main() {
  // We get the contract to deploy
  const toBigNum = ethers.BigNumber.from;
  const basefee = await ethers.provider.getGasPrice();
  const gasPrice = toBigNum(basefee).add(toBigNum('10000000000')) // add tip
  console.log(`BWB gasPrice is ${gasPrice}`);
  const LC = await ethers.getContractFactory("ShortLockupContract");
  let d = new Date()
  d.setSeconds(d.getSeconds() + (10 * 60));
  const unlockTime = Math.floor(d.getTime() / 1000)
  const lockup = await LC.deploy('0x094bd7B2D99711A1486FB94d4395801C6d0fdDcC', '0xac60D353040e10Ee5DD91360cDDf710693a0db38', unlockTime, {gasPrice: gasPrice});

  console.log("Lockup deployed to:", lockup.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
