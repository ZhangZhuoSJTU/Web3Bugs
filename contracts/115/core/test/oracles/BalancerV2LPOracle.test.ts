import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect, assert } from "chai";

import {
  MockERC20,
  MockChainlinkAggregator,
  MockBalancerPool,
  MockBalancerVault,
  BalancerV2LPOracle,
} from "../../typechain-types";

const EUR_PRICE = 110000000; // 1 EUR = 1.1 USD
const USDC_PRICE = 100000000; // 1 USDC = 1 USD

const setup = deployments.createFixture(async () => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("MockERC20", {
    from: deployer,
    args: ["USDC", "USDC", "6"],
    log: true,
  });
  const usdc: MockERC20 = await ethers.getContract("MockERC20");

  await deploy("MockERC20", {
    from: deployer,
    args: ["PAR", "PAR", "18"],
    log: true,
  });
  const par: MockERC20 = await ethers.getContract("MockERC20");

  await deploy("MockChainlinkAggregator", {
    from: deployer,
    args: [8, USDC_PRICE, "USDC / USD"],
    log: true,
  });
  const aggregatorUSDC: MockChainlinkAggregator = await ethers.getContract("MockChainlinkAggregator");

  await deploy("MockChainlinkAggregator", {
    from: deployer,
    args: [8, EUR_PRICE, "EUR / USD"],
    log: true,
  });
  const aggregatorEUR: MockChainlinkAggregator = await ethers.getContract("MockChainlinkAggregator");

  await deploy("MockBalancerPool", {
    from: deployer,
    args: [usdc.address, par.address],
    log: true,
  });
  const pool: MockBalancerPool = await ethers.getContract("MockBalancerPool");

  await deploy("MockBalancerVault", {
    from: deployer,
    args: [[usdc.address, par.address], pool.address],
    log: true,
  });
  const vault: MockBalancerVault = await ethers.getContract("MockBalancerVault");

  await deploy("BalancerV2LPOracle", {
    from: deployer,
    args: [
      18,
      "PAR/USDC",
      vault.address,
      "0x5d6e3d7632d6719e04ca162be652164bec1eaa6b000200000000000000000048",
      aggregatorUSDC.address,
      aggregatorEUR.address,
    ],
    log: true,
  });
  const oracle: BalancerV2LPOracle = await ethers.getContract("BalancerV2LPOracle");

  await pool.setTotalSupply("210000000000000");
  await pool.setNormalizedWeight(usdc.address, "500000000000000000");
  await pool.setNormalizedWeight(par.address, "500000000000000000");
  await vault.setBalances(["110", "100000000000000"]);

  return { oracle, pool, vault, aggregatorUSDC, aggregatorEUR };
});

it("Oracle initializes correctly", async () => {
  const { oracle, pool, aggregatorUSDC, aggregatorEUR } = await setup();

  const description = await oracle.description();
  expect(description).to.equal("PAR/USDC");

  const decimals = await oracle.decimals();
  assert.equal(decimals.toString(), "18");

  assert.equal(await oracle.pool(), pool.address);
  assert.equal(await oracle.oracleA(), aggregatorUSDC.address);
  assert.equal(await oracle.oracleB(), aggregatorEUR.address);
});

it("Oracle returns data", async () => {
  const { oracle, pool, vault } = await setup();

  let data = await oracle.latestRoundData();
  expect(data[1].toString()).to.equal("104761904");

  // Half the supply
  await pool.setTotalSupply("105000000000000");
  data = await oracle.latestRoundData();
  expect(data[1].toString()).to.equal("209523809");

  // Double usdc, and half par
  await vault.setBalances(["220", "50000000000000"]);
  data = await oracle.latestRoundData();
  expect(data[1].toString()).to.equal("209523809");
});
