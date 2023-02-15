import chai from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  makeCheckpoint,
  signHash,
  examplePowers,
  ZeroAddress,
} from "../test-utils/pure";

chai.use(solidity);
const { expect } = chai;


describe("Gravity happy path valset update + batch submit", function () {
  it("Happy path", async function () {

    // DEPLOY CONTRACTS
    // ================

    const signers = await ethers.getSigners();
    const gravityId = ethers.utils.formatBytes32String("foo");

    const valset0 = {
      // This is the power distribution on the Cosmos hub as of 7/14/2020
      powers: examplePowers(),
      validators: signers.slice(0, examplePowers().length),
      valsetNonce: 0,
      rewardAmount: 0,
      rewardToken: ZeroAddress
    }


    const powerThreshold = 6666;

    const {
      gravity,
      testERC20,
      checkpoint: deployCheckpoint
    } = await deployContracts(gravityId, powerThreshold, valset0.validators, valset0.powers);




    // UDPATEVALSET
    // ============

    const valset1 = (() => {
      // Make new valset by modifying some powers
      let powers = examplePowers();
      powers[0] -= 3;
      powers[1] += 3;
      let validators = signers.slice(0, powers.length);

      return {
        powers: powers,
        validators: validators,
        valsetNonce: 1,
        rewardAmount: 0,
        rewardToken: ZeroAddress
      }
    })()

    // redefine valset0 and 1 with strings for 'validators'
    const valset0_str = {
      powers: valset0.powers,
      validators: await getSignerAddresses(valset0.validators),
      valsetNonce: valset0.valsetNonce,
      rewardAmount: valset0.rewardAmount,
      rewardToken: valset0.rewardToken
    }
    const valset1_str = {
      powers: valset1.powers,
      validators: await getSignerAddresses(valset1.validators),
      valsetNonce: valset1.valsetNonce,
      rewardAmount: valset1.rewardAmount,
      rewardToken: valset1.rewardToken
    }

    const checkpoint1 = makeCheckpoint(
      valset1_str.validators,
      valset1_str.powers,
      valset1_str.valsetNonce,
      valset1_str.rewardAmount,
      valset1_str.rewardToken,
      gravityId
    );

    let sigs1 = await signHash(valset0.validators, checkpoint1);

    await gravity.updateValset(
      valset1_str,

      valset0_str,

      sigs1.v,
      sigs1.r,
      sigs1.s
    );

    expect((await gravity.functions.state_lastValsetCheckpoint())[0]).to.equal(checkpoint1);




    // SUBMITBATCH
    // ==========================

    // Transfer out to Cosmos, locking coins
    await testERC20.functions.approve(gravity.address, 1000);
    await gravity.functions.sendToCosmos(
      testERC20.address,
      ethers.utils.formatBytes32String("myCosmosAddress"),
      1000
    );

    // Transferring into ERC20 from Cosmos
    const numTxs = 100;
    const txDestinationsInt = new Array(numTxs);
    const txFees = new Array(numTxs);
    let totalFees = 0;
    const txAmounts = new Array(numTxs);
    for (let i = 0; i < numTxs; i++) {
      txFees[i] = 1;
      totalFees += 1;
      txAmounts[i] = 1;
      txDestinationsInt[i] = signers[i + 5];
    }

    const txDestinations = await getSignerAddresses(txDestinationsInt);

    const batchNonce = 1
    const batchTimeout = 10000000

    const methodName = ethers.utils.formatBytes32String(
      "transactionBatch"
    );

    let abiEncoded = ethers.utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "bytes32",
        "uint256[]",
        "address[]",
        "uint256[]",
        "uint256",
        "address",
        "uint256"
      ],
      [
        gravityId,
        methodName,
        txAmounts,
        txDestinations,
        txFees,
        batchNonce,
        testERC20.address,
        batchTimeout
      ]
    );

    let digest = ethers.utils.keccak256(abiEncoded);

    let sigs = await signHash(valset1.validators, digest);

    let batchSubmitTx = await gravity.submitBatch(
      valset1_str,

      sigs.v,
      sigs.r,
      sigs.s,

      txAmounts,
      txDestinations,
      txFees,
      batchNonce,
      testERC20.address,
      batchTimeout
    );

    // check that the transfer was successful
    expect(
      await (
        await testERC20.functions.balanceOf(await signers[6].getAddress())
      )[0].toNumber()
    ).to.equal(1);

    // check that the relayer was paid
    expect(
      await (
        await testERC20.functions.balanceOf(await batchSubmitTx.from)
      )[0].toNumber()
    ).to.equal(9000 + totalFees);
  });
});
