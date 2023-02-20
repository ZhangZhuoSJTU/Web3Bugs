// @ts-nocheck

import { ethers } from "hardhat";
import { expect } from "chai";

// Still WIP
describe.skip("Migration", function () {
  let chef, migrator, usdcWethLp, usdc, weth;

  const masterChefABI = [
    {
      inputs: [],
      name: "migrator",
      outputs: [
        { internalType: "contract IMigratorChef", name: "", type: "address" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "contract IMigratorChef",
          name: "_migrator",
          type: "address",
        },
      ],
      name: "setMigrator",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],
      name: "migrate",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  before(async () => {
    const [alice, feeTo] = await ethers.getSigners();

    const _owner = "0x9a8541ddf3a932a9a922b607e9cf7301f1d47bd1";
    const chefOwner = await ethers.getSigner(_owner);

    await network.provider.send("hardhat_setBalance", [
      _owner,
      "0x1000000000000000000",
    ]);
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [_owner],
    });

    chef = await ethers.getContractAt(
      masterChefABI,
      "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd",
      chefOwner
    );

    const ERC20 = await ethers.getContractFactory("ERC20Mock");

    weth = await ERC20.attach("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    usdc = await ERC20.attach("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    usdcWethLp = await ERC20.attach(
      "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0"
    );

    const BentoBox = await ethers.getContractFactory("BentoBoxV1");
    const bentoBox = await BentoBox.deploy(weth.address);

    const MasterDeployer = await ethers.getContractFactory("MasterDeployer");
    const masterDeployer = await MasterDeployer.deploy(
      0,
      feeTo.address,
      bentoBox.address
    );

    const Factory = await ethers.getContractFactory(
      "ConstantProductPoolFactory"
    );
    const factory = await Factory.deploy(masterDeployer.address);

    const Migrator = await ethers.getContractFactory("Migrator");
    migrator = await Migrator.deploy(
      chef.address,
      bentoBox.address,
      factory.address
    );

    await chef.setMigrator(migrator.address);
    await masterDeployer.setMigrator(migrator.address);
  });

  it("Should prepare for migration", async () => {
    const _migrator = await chef.migrator();
    expect(_migrator).to.be.eq(migrator.address);
  });

  it("Should migrate successfully", async () => {
    const oldTotalSupply = await usdcWethLp.totalSupply();
    const oldUsdcBalance = await usdc.balanceOf(usdcWethLp.address);
    const oldWethBalance = await weth.balanceOf(usdcWethLp.address);

    await chef.migrate(1);

    const newTotalSupply = await usdcWethLp.totalSupply();
    const newUsdcBalance = await usdc.balanceOf(usdcWethLp.address);
    const newWethBalance = await weth.balanceOf(usdcWethLp.address);

    expect(oldTotalSupply.gt(newTotalSupply)).to.be.true;
    expect(oldUsdcBalance.gt(newUsdcBalance)).to.be.true;
    expect(oldWethBalance.gt(newWethBalance)).to.be.true;
  });
});
