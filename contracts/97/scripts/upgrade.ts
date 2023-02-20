import { ethers, upgrades } from "hardhat";

export async function upgradeLiquidityPool(proxyAddress: string) {
  await upgrades.upgradeProxy(proxyAddress, await ethers.getContractFactory("LiquidityPool"));
  console.log("LiquidityPool Upgraded");
}

export async function upgradeLiquidityProviders(proxyAddress: string) {
  await upgrades.upgradeProxy(proxyAddress, await ethers.getContractFactory("LiquidityProviders"));
  console.log("LiquidityProviders Upgraded");
}

export async function upgradeLPToken(proxyAddress: string) {
  await upgrades.upgradeProxy(proxyAddress, await ethers.getContractFactory("LPToken"));
  console.log("LpToken Upgraded");
}

export async function upgradeWhiteListPeriodManager(proxyAddress: string) {
  await upgrades.upgradeProxy(proxyAddress, await ethers.getContractFactory("WhitelistPeriodManager"));
  console.log("WhitelistPeriodManager Upgraded");
}

export async function upgradeLiquidityFarming(proxyAddress: string) {
  await upgrades.upgradeProxy(proxyAddress, await ethers.getContractFactory("HyphenLiquidityFarming"));
  console.log("LiquidityFarming Upgraded");
}
