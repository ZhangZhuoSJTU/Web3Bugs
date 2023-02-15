import chai from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { TestLogicContract } from "../typechain/TestLogicContract";
import { SimpleLogicBatchMiddleware } from "../typechain/SimpleLogicBatchMiddleware";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  signHash,
  examplePowers,
  ZeroAddress
} from "../test-utils/pure";

chai.use(solidity);
const { expect } = chai;


async function runTest(opts: {
  // Issues with the tx batch
  invalidationNonceNotHigher?: boolean;
  malformedTxBatch?: boolean;

  // Issues with the current valset and signatures
  nonMatchingCurrentValset?: boolean;
  badValidatorSig?: boolean;
  zeroedValidatorSig?: boolean;
  notEnoughPower?: boolean;
  barelyEnoughPower?: boolean;
  malformedCurrentValset?: boolean;
  timedOut?: boolean;
}) {



  // Prep and deploy contract
  // ========================
  const signers = await ethers.getSigners();
  const gravityId = ethers.utils.formatBytes32String("foo");
  // This is the power distribution on the Cosmos hub as of 7/14/2020
  let powers = examplePowers();
  let validators = signers.slice(0, powers.length);
  const powerThreshold = 6666;
  const {
    gravity,
    testERC20,
    checkpoint: deployCheckpoint
  } = await deployContracts(gravityId,  powerThreshold, validators, powers);

  // First we deploy the logic batch middleware contract. This makes it easy to call a logic 
  // contract a bunch of times in a batch.
  const SimpleLogicBatchMiddleware = await ethers.getContractFactory("SimpleLogicBatchMiddleware");
  const logicBatch = (await SimpleLogicBatchMiddleware.deploy()) as SimpleLogicBatchMiddleware;
  // We set the ownership to gravity so that nobody else can call it.
  await logicBatch.transferOwnership(gravity.address);

  // Then we deploy the actual logic contract.
  const TestLogicContract = await ethers.getContractFactory("TestLogicContract");
  const logicContract = (await TestLogicContract.deploy(testERC20.address)) as TestLogicContract;
  // We set its owner to the batch contract. 
  await logicContract.transferOwnership(logicBatch.address);


  // Transfer out to Cosmos, locking coins
  // =====================================
  await testERC20.functions.approve(gravity.address, 1000);
  await gravity.functions.sendToCosmos(
    testERC20.address,
    ethers.utils.formatBytes32String("myCosmosAddress"),
    1000
  );



  // Prepare batch
  // ===============================
  // This code prepares the batch of transactions by encoding the arguments to the logicContract.
  // This batch contains 10 transactions which each:
  // - Transfer 5 coins to the logic contract
  // - Call transferTokens on the logic contract, transferring 2+2 coins to signer 20
  //
  // After the batch runs, signer 20 should have 40 coins, Gravity should have 940 coins,
  // and the logic contract should have 10 coins
  const numTxs = 10;
  const txPayloads = new Array(numTxs);

  const txAmounts = new Array(numTxs);
  for (let i = 0; i < numTxs; i++) {
    txAmounts[i] = 5;
    txPayloads[i] = logicContract.interface.encodeFunctionData("transferTokens", [await signers[20].getAddress(), 2, 2])
  }

  let invalidationNonce = 1
  if (opts.invalidationNonceNotHigher) {
    invalidationNonce = 0
  }

  let timeOut = 4766922941000
  if (opts.timedOut) {
    timeOut = 0
  }


  // Call method
  // ===========
  // We have to give the logicBatch contract 5 coins for each tx, since it will transfer that
  // much to the logic contract.
  // We give msg.sender 1 coin in fees for each tx.
  const methodName = ethers.utils.formatBytes32String(
    "logicCall"
  );

  let logicCallArgs = {
    transferAmounts: [numTxs * 5], // transferAmounts
    transferTokenContracts: [testERC20.address], // transferTokenContracts
    feeAmounts: [numTxs], // feeAmounts
    feeTokenContracts: [testERC20.address], // feeTokenContracts
    logicContractAddress: logicBatch.address, // logicContractAddress
    payload: logicBatch.interface.encodeFunctionData("logicBatch", [txAmounts, txPayloads, logicContract.address, testERC20.address]), // payloads
    timeOut,
    invalidationId: ethers.utils.hexZeroPad(testERC20.address, 32), // invalidationId
    invalidationNonce: invalidationNonce // invalidationNonce
  }


  const digest = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
    [
      "bytes32", // gravityId
      "bytes32", // methodName
      "uint256[]", // transferAmounts
      "address[]", // transferTokenContracts
      "uint256[]", // feeAmounts
      "address[]", // feeTokenContracts
      "address", // logicContractAddress
      "bytes", // payload
      "uint256", // timeOut
      "bytes32", // invalidationId
      "uint256" // invalidationNonce
    ],
    [
      gravityId,
      methodName,
      logicCallArgs.transferAmounts,
      logicCallArgs.transferTokenContracts,
      logicCallArgs.feeAmounts,
      logicCallArgs.feeTokenContracts,
      logicCallArgs.logicContractAddress,
      logicCallArgs.payload,
      logicCallArgs.timeOut,
      logicCallArgs.invalidationId,
      logicCallArgs.invalidationNonce
    ]
  ));

  const sigs = await signHash(validators, digest);
  
  let currentValsetNonce = 0;
  if (opts.nonMatchingCurrentValset) {
    // Wrong nonce
    currentValsetNonce = 420;
  }
  if (opts.malformedCurrentValset) {
    // Remove one of the powers to make the length not match
    powers.pop();
  }
  if (opts.badValidatorSig) {
    // Switch the first sig for the second sig to screw things up
    sigs.v[1] = sigs.v[0];
    sigs.r[1] = sigs.r[0];
    sigs.s[1] = sigs.s[0];
  }
  if (opts.zeroedValidatorSig) {
    // Switch the first sig for the second sig to screw things up
    sigs.v[1] = sigs.v[0];
    sigs.r[1] = sigs.r[0];
    sigs.s[1] = sigs.s[0];
    // Then zero it out to skip evaluation
    sigs.v[1] = 0;
  }
  if (opts.notEnoughPower) {
    // zero out enough signatures that we dip below the threshold
    sigs.v[1] = 0;
    sigs.v[2] = 0;
    sigs.v[3] = 0;
    sigs.v[5] = 0;
    sigs.v[6] = 0;
    sigs.v[7] = 0;
    sigs.v[9] = 0;
    sigs.v[11] = 0;
    sigs.v[13] = 0;
  }
  if (opts.barelyEnoughPower) {
    // Stay just above the threshold
    sigs.v[1] = 0;
    sigs.v[2] = 0;
    sigs.v[3] = 0;
    sigs.v[5] = 0;
    sigs.v[6] = 0;
    sigs.v[7] = 0;
    sigs.v[9] = 0;
    sigs.v[11] = 0;
  }

  let valset = {
    validators: await getSignerAddresses(validators),
    powers,
    valsetNonce: currentValsetNonce,
    rewardAmount: 0,
    rewardToken: ZeroAddress
  }

  let logicCallSubmitResult = await gravity.submitLogicCall(
    valset,

    sigs.v,
    sigs.r,
    sigs.s,
    logicCallArgs
  );


    // check that the relayer was paid
    expect(
      await (
        await testERC20.functions.balanceOf(await logicCallSubmitResult.from)
      )[0].toNumber()
    ).to.equal(9010);

  expect(
      (await testERC20.functions.balanceOf(await signers[20].getAddress()))[0].toNumber()
  ).to.equal(40);

  expect(
    (await testERC20.functions.balanceOf(gravity.address))[0].toNumber()
  ).to.equal(940);

  expect(
      (await testERC20.functions.balanceOf(logicContract.address))[0].toNumber()
  ).to.equal(10);
  
  expect(
    (await testERC20.functions.balanceOf(await signers[0].getAddress()))[0].toNumber()
  ).to.equal(9010);
}

describe("submitLogicCall tests", function () {
  it("throws on malformed current valset", async function () {
    await expect(runTest({ malformedCurrentValset: true })).to.be.revertedWith(
      "Malformed current validator set"
    );
  });

  it("throws on invalidation nonce not incremented", async function () {
    await expect(runTest({ invalidationNonceNotHigher: true })).to.be.revertedWith(
      "New invalidation nonce must be greater than the current nonce"
    );
  });

  it("throws on non matching checkpoint for current valset", async function () {
    await expect(
      runTest({ nonMatchingCurrentValset: true })
    ).to.be.revertedWith(
      "Supplied current validators and powers do not match checkpoint"
    );
  });


  it("throws on bad validator sig", async function () {
    await expect(runTest({ badValidatorSig: true })).to.be.revertedWith(
      "Validator signature does not match"
    );
  });

  it("allows zeroed sig", async function () {
    await runTest({ zeroedValidatorSig: true });
  });

  it("throws on not enough signatures", async function () {
    await expect(runTest({ notEnoughPower: true })).to.be.revertedWith(
      "Submitted validator set signatures do not have enough power"
    );
  });

  it("does not throw on barely enough signatures", async function () {
    await runTest({ barelyEnoughPower: true });
  });

  it("throws on timeout", async function () {
    await expect(runTest({ timedOut: true })).to.be.revertedWith(
      "Timed out"
    );
  });

});

// This test produces a hash for the contract which should match what is being used in the Go unit tests. It's here for
// the use of anyone updating the Go tests.
describe("logicCall Go test hash", function () {
  it("produces good hash", async function () {


    // Prep and deploy contract
    // ========================
    const signers = await ethers.getSigners();
    const gravityId = ethers.utils.formatBytes32String("foo");
    const powers = [6667];
    const validators = signers.slice(0, powers.length);
    const powerThreshold = 6666;
    const {
      gravity,
      testERC20,
      checkpoint: deployCheckpoint
    } = await deployContracts(gravityId, powerThreshold, validators, powers);



    // Transfer out to Cosmos, locking coins
    // =====================================
    await testERC20.functions.approve(gravity.address, 1000);
    await gravity.functions.sendToCosmos(
      testERC20.address,
      ethers.utils.formatBytes32String("myCosmosAddress"),
      1000
    );



    // Call method
    // ===========
  const methodName = ethers.utils.formatBytes32String(
    "logicCall"
  );
  const numTxs = 10;

  let invalidationNonce = 1

  let timeOut = 4766922941000

  let logicCallArgs = {
    transferAmounts: [1], // transferAmounts
    transferTokenContracts: [testERC20.address], // transferTokenContracts
    feeAmounts: [1], // feeAmounts
    feeTokenContracts: [testERC20.address], // feeTokenContracts
    logicContractAddress: "0x17c1736CcF692F653c433d7aa2aB45148C016F68", // logicContractAddress
    payload: ethers.utils.formatBytes32String("testingPayload"), // payloads
    timeOut,
    invalidationId: ethers.utils.formatBytes32String("invalidationId"), // invalidationId
    invalidationNonce: invalidationNonce // invalidationNonce
  }


  const abiEncodedLogicCall = ethers.utils.defaultAbiCoder.encode(
    [
      "bytes32", // gravityId
      "bytes32", // methodName
      "uint256[]", // transferAmounts
      "address[]", // transferTokenContracts
      "uint256[]", // feeAmounts
      "address[]", // feeTokenContracts
      "address", // logicContractAddress
      "bytes", // payload
      "uint256", // timeOut
      "bytes32", // invalidationId
      "uint256" // invalidationNonce
    ],
    [
      gravityId,
      methodName,
      logicCallArgs.transferAmounts,
      logicCallArgs.transferTokenContracts,
      logicCallArgs.feeAmounts,
      logicCallArgs.feeTokenContracts,
      logicCallArgs.logicContractAddress,
      logicCallArgs.payload,
      logicCallArgs.timeOut,
      logicCallArgs.invalidationId,
      logicCallArgs.invalidationNonce
    ]
  );
    const logicCallDigest = ethers.utils.keccak256(abiEncodedLogicCall);


    const sigs = await signHash(validators, logicCallDigest);
    const currentValsetNonce = 0;

    // TODO construct the easiest possible delegate contract that will
    // actually execute, existing ones are too large to bother with for basic
    // signature testing

    let valset = {
      validators: await getSignerAddresses(validators),
      powers,
      valsetNonce: currentValsetNonce,
      rewardAmount: 0,
      rewardToken: ZeroAddress
    }

    var res = await gravity.populateTransaction.submitLogicCall(
      valset,

      sigs.v,
      sigs.r,
      sigs.s,

      logicCallArgs
    )

    console.log("elements in logic call digest:", {
      "gravityId": gravityId,
      "logicMethodName": methodName,
      "transferAmounts": logicCallArgs.transferAmounts,
      "transferTokenContracts": logicCallArgs.transferTokenContracts,
      "feeAmounts": logicCallArgs.feeAmounts,
      "feeTokenContracts": logicCallArgs.feeTokenContracts,
      "logicContractAddress": logicCallArgs.logicContractAddress,
      "payload": logicCallArgs.payload,
      "timeout": logicCallArgs.timeOut,
      "invalidationId": logicCallArgs.invalidationId,
      "invalidationNonce": logicCallArgs.invalidationNonce
    })
    console.log("abiEncodedCall:", abiEncodedLogicCall)
    console.log("callDigest:", logicCallDigest)

    console.log("elements in logic call function call:", {
      "currentValidators": await getSignerAddresses(validators),
      "currentPowers": powers,
      "currentValsetNonce": currentValsetNonce,
      "sigs": sigs,
    })
    console.log("Function call bytes:", res.data)

})});