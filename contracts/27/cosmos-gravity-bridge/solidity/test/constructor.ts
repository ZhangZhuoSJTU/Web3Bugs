import chai from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  makeCheckpoint,
  signHash,
  makeTxBatchHash,
  examplePowers
} from "../test-utils/pure";

chai.use(solidity);
const { expect } = chai;

describe("constructor tests", function() {
  it("throws on malformed valset", async function() {
    const signers = await ethers.getSigners();
    const gravityId = ethers.utils.formatBytes32String("foo");

    // This is the power distribution on the Cosmos hub as of 7/14/2020
    let powers = examplePowers();
    let validators = signers.slice(0, powers.length - 1);

    const powerThreshold = 6666;

    await expect(
      deployContracts(gravityId, powerThreshold, validators, powers,)
    ).to.be.revertedWith("Malformed current validator set");
  });

  it("throws on insufficient power", async function() {
    const signers = await ethers.getSigners();
    const gravityId = ethers.utils.formatBytes32String("foo");

    // This is the power distribution on the Cosmos hub as of 7/14/2020
    let powers = examplePowers();
    let validators = signers.slice(0, powers.length);

    const powerThreshold = 666666666;

    await expect(
      deployContracts(gravityId, powerThreshold, validators, powers)
    ).to.be.revertedWith(
      "Submitted validator set signatures do not have enough power"
    );
  });
});
