import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect, assert } from "chai";

import { MockERC20, MockChainlinkAggregator, MockGUniPool, GUniLPOracle } from "../../typechain-types";

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

  await deploy("MockGUniPool", {
    from: deployer,
    args: [usdc.address, par.address],
    log: true,
  });
  const pool: MockGUniPool = await ethers.getContract("MockGUniPool");

  await deploy("GUniLPOracle", {
    from: deployer,
    args: [18, "PAR/USDC", pool.address, aggregatorUSDC.address, aggregatorEUR.address],
    log: true,
  });
  const oracle: GUniLPOracle = await ethers.getContract("GUniLPOracle");

  await pool.setTotalSupply("210000000000000");
  await pool.setBalance("110", "100000000000000");

  return { oracle, pool, aggregatorUSDC, aggregatorEUR };
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
  const { oracle, pool } = await setup();

  let data = await oracle.latestRoundData();
  expect(data[1].toString()).to.equal("104761904");

  // Half the supply
  await pool.setTotalSupply("105000000000000");
  data = await oracle.latestRoundData();
  expect(data[1].toString()).to.equal("209523809");
});
