import hre from "hardhat";

async function main() {
  const SafeFactory = await hre.ethers.getContractFactory("SafeFactory");
  const safeFactory = await SafeFactory.deploy();

  await safeFactory.deployed();

  console.log("SafeFactory deployed to:", safeFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
