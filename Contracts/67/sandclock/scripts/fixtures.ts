import { parseUnits } from "@ethersproject/units";
import { BigNumber } from "ethers";
import { run, ethers } from "hardhat";

async function main() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  const underlying = await ethers.getContractAt(
    "MockERC20",
    "0x91b72467CFB9Bb79697AD58DBfcbd7dA8E4B65DA"
  );
  const vault = await ethers.getContractAt(
    "Vault",
    "0xAb8Ea4F82d918c26788A05a87871b7b17DeD3F16"
  );

  await underlying.mint(alice.address, parseUnits("5000", 6));
  await underlying.mint(bob.address, parseUnits("5000", 6));
  await underlying.mint(carol.address, parseUnits("5000", 6));

  await Promise.all(
    [alice, bob, carol].map((account) =>
      underlying.connect(account).approve(vault.address, parseUnits("5000", 6))
    )
  );

  console.log("Carol sponsors 1000");
  const lastTimestamp = (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
  const lockUntil = (await vault.MIN_SPONSOR_LOCK_DURATION())
    .add(lastTimestamp)
    .add(60);
  await vault.connect(carol).sponsor(parseUnits("1000", 6), lockUntil);

  console.log("Alice deposits 1000 with 100% to Alice");
  await vault.connect(alice).deposit({
    amount: parseUnits("1000", 6),
    lockedUntil: 0,
    claims: [
      {
        beneficiary: alice.address,
        pct: 10000,
        data: "0x",
      },
    ],
  });

  console.log("Bob deposits 1000 with 50% to Alice and 50% to Bob");
  await vault.connect(bob).deposit({
    amount: parseUnits("1000", 6),
    lockedUntil: 0,
    claims: [
      {
        beneficiary: bob.address,
        pct: 5000,
        data: "0x",
      },
      {
        beneficiary: alice.address,
        pct: 5000,
        data: "0x",
      },
    ],
  });

  console.log("2000 yield is generated");
  await underlying.mint(vault.address, parseUnits("2000", 6));

  console.log("Alice claims");
  await vault.connect(alice).claimYield(alice.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
