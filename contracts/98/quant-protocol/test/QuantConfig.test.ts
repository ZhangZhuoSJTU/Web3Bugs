import { Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { beforeEach, describe, it } from "mocha";
import { QuantConfigV2 } from "../typechain";
import { QuantConfig } from "../typechain/QuantConfig";
import { expect } from "./setup";

describe("QuantConfig", () => {
  let quantConfig: QuantConfig;
  let timelockController: Signer;
  let secondAccount: Signer;

  const protocolFee = ethers.utils.id("fee");

  const priceRegistry = ethers.utils.id("priceRegistry");

  beforeEach(async () => {
    [timelockController, secondAccount] = await ethers.getSigners();
    const QuantConfig = await ethers.getContractFactory("QuantConfig");
    quantConfig = <QuantConfig>(
      await upgrades.deployProxy(QuantConfig, [
        await timelockController.getAddress(),
      ])
    );
  });

  it("Should return the set TimelockController", async () => {
    expect(await quantConfig.timelockController()).to.equal(
      await timelockController.getAddress()
    );
  });

  it("Protocol fee should start as 0", async () => {
    expect(await quantConfig.protocolUints256(protocolFee)).to.equal(
      ethers.BigNumber.from("0")
    );
  });

  it("Admin should be able to set the protocol fee", async () => {
    await quantConfig
      .connect(timelockController)
      .setProtocolUint256(protocolFee, ethers.BigNumber.from("300"));
    expect(await quantConfig.protocolUints256(protocolFee)).to.equal(
      ethers.BigNumber.from("300")
    );
  });

  it("Should revert when a non-admin account tries to change the protocol fee", async () => {
    await expect(
      quantConfig
        .connect(secondAccount)
        .setProtocolUint256(protocolFee, ethers.BigNumber.from("100"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should maintain state across upgrades", async () => {
    await quantConfig
      .connect(timelockController)
      .setProtocolUint256(protocolFee, ethers.BigNumber.from("200"));
    const QuantConfigV2 = await ethers.getContractFactory("QuantConfigV2");
    quantConfig = <QuantConfig>(
      await upgrades.upgradeProxy(quantConfig.address, QuantConfigV2)
    );
    expect(await quantConfig.protocolUints256(protocolFee)).to.equal(
      ethers.BigNumber.from("200")
    );
  });

  it("Should be able to add new state variables through upgrades", async () => {
    const QuantConfigV2 = await ethers.getContractFactory("QuantConfigV2");
    const quantConfigv2 = <QuantConfigV2>(
      await upgrades.upgradeProxy(quantConfig.address, QuantConfigV2)
    );
    expect(await quantConfigv2.newV2StateVariable()).to.equal(
      ethers.BigNumber.from("0")
    );
  });
  it("Admin should still be able to set the protocol fee after an upgrade", async () => {
    const QuantConfigV2 = await ethers.getContractFactory("QuantConfigV2");
    quantConfig = <QuantConfig>(
      await upgrades.upgradeProxy(quantConfig.address, QuantConfigV2)
    );
    await quantConfig
      .connect(timelockController)
      .setProtocolUint256(protocolFee, ethers.BigNumber.from("400"));
    expect(await quantConfig.protocolUints256(protocolFee)).to.equal(
      ethers.BigNumber.from("400")
    );
  });

  it("Should revert when trying to set the priceRegistry twice", async () => {
    await quantConfig
      .connect(timelockController)
      .setProtocolAddress(priceRegistry, ethers.Wallet.createRandom().address);
    await expect(
      quantConfig.setProtocolAddress(
        priceRegistry,
        ethers.Wallet.createRandom().address
      )
    ).to.be.revertedWith("QuantConfig: priceRegistry can only be set once");
  });

  it("Should revert when trying to change isPriceRegistrySet after the priceRegistry had already been set once", async () => {
    await quantConfig
      .connect(timelockController)
      .setProtocolAddress(priceRegistry, ethers.Wallet.createRandom().address);
    await expect(
      quantConfig.setProtocolBoolean(
        ethers.utils.id("isPriceRegistrySet"),
        false
      )
    ).to.be.revertedWith(
      "QuantConfig: can only change isPriceRegistrySet once"
    );
  });

  it("Should revert when trying to set a role admin with an unauthorized account", async () => {
    await expect(
      quantConfig
        .connect(secondAccount)
        .setRoleAdmin(
          ethers.utils.id("PRICE_SUBMITTER_ROLE"),
          ethers.utils.id("ORACLE_MANAGER_ROLE")
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should return the correct length for protocol value arrays", async () => {
    // there is 1 role configured in the initialize method (ORACLE_MANAGER_ROLE)
    const initialQuantRoles = 1;

    expect(await quantConfig.protocolAddressesLength()).to.equal(0);
    expect(await quantConfig.protocolUints256Length()).to.equal(0);
    expect(await quantConfig.protocolBooleansLength()).to.equal(0);
    expect(await quantConfig.quantRolesLength()).to.equal(initialQuantRoles);

    const randomNumber = (): number => {
      return Math.floor(Math.random() * 10 + 1);
    };

    const numAddresses = randomNumber();
    for (let i = 0; i < numAddresses; i++) {
      await quantConfig
        .connect(timelockController)
        .setProtocolAddress(
          ethers.utils.id(`protocolAddress${i}`),
          ethers.Wallet.createRandom().address
        );
    }

    const numUints = randomNumber();
    for (let i = 0; i < numUints; i++) {
      await quantConfig
        .connect(timelockController)
        .setProtocolUint256(ethers.utils.id(`protocolUint${i}`), i);
    }

    const numBooleans = randomNumber();
    for (let i = 0; i < numBooleans; i++) {
      await quantConfig
        .connect(timelockController)
        .setProtocolBoolean(ethers.utils.id(`protocolBoolean${i}`), i % 2 == 0);
    }

    const numRoles = randomNumber();
    for (let i = 0; i < numRoles; i++) {
      await quantConfig
        .connect(timelockController)
        .setProtocolRole(
          `protocolRole${i}`,
          await timelockController.getAddress()
        );
    }

    expect(await quantConfig.protocolAddressesLength()).to.equal(numAddresses);
    expect(await quantConfig.protocolUints256Length()).to.equal(numUints);
    expect(await quantConfig.protocolBooleansLength()).to.equal(numBooleans);
    expect(await quantConfig.quantRolesLength()).to.equal(
      numRoles + initialQuantRoles
    );
  });
});
