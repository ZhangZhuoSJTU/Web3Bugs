import chai from "chai";
import { ethers} from "hardhat";
import { solidity } from "ethereum-waffle";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  makeCheckpoint,
  signHash,
  examplePowers,
  ZeroAddress,
  parseEvent
} from "../test-utils/pure";
import { openStdin } from "node:process";
import { format } from "prettier";

chai.use(solidity);
const { expect } = chai;

async function runTest(opts: {
  malformedNewValset?: boolean;
  malformedCurrentValset?: boolean;
  nonMatchingCurrentValset?: boolean;
  nonceNotIncremented?: boolean;
  badValidatorSig?: boolean;
  zeroedValidatorSig?: boolean;
  notEnoughPower?: boolean;
  badReward?: boolean;
  notEnoughReward?: boolean;
  withReward?: boolean;
}) {
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
  } = await deployContracts(gravityId, powerThreshold, validators, powers);

  let newPowers = examplePowers();
  newPowers[0] -= 3;
  newPowers[1] += 3;

  let newValidators = signers.slice(0, newPowers.length);
  if (opts.malformedNewValset) {
    // Validators and powers array don't match
    newValidators = signers.slice(0, newPowers.length - 1);
  }

  let currentValsetNonce = 0;
  if (opts.nonMatchingCurrentValset) {
    powers[0] = 78;
  }
  let newValsetNonce = 1;
  if (opts.nonceNotIncremented) {
    newValsetNonce = 0;
  }

  let currentValset = {
    validators: await getSignerAddresses(validators),
    powers,
    valsetNonce: currentValsetNonce,
    rewardAmount: 0,
    rewardToken: ZeroAddress
  }

  let newValset = {
    validators: await getSignerAddresses(newValidators),
    powers: newPowers,
    valsetNonce: newValsetNonce,
    rewardAmount: 0,
    rewardToken: ZeroAddress
  }

  let ERC20contract;
  if (opts.badReward) {
    // some amount of a reward, in a random token that's not in the bridge
    // should panic because the token doesn't exist
    newValset.rewardAmount = 5000000;
    newValset.rewardToken = "0x8bcd7D3532CB626A7138962Bdb859737e5B6d4a7";
  } else if (opts.withReward) {
    // deploy a ERC20 representing a Cosmos asset, as this is the common
    // case for validator set rewards
    const eventArgs = await parseEvent(gravity, gravity.deployERC20('uatom', 'Atom', 'ATOM', 6), 1)
    newValset.rewardToken = eventArgs._tokenContract
    // five atom, issued as an inflationary reward
    newValset.rewardAmount = 5000000

    // connect with the contract to check balances later
    ERC20contract = new ethers.Contract(eventArgs._tokenContract, [
      "function balanceOf(address account) view returns (uint256 balance)"
    ], gravity.provider);

  } else if (opts.notEnoughReward) {
    // send in 1000 tokens, then have a reward of five million
    await testERC20.functions.approve(gravity.address, 1000);
    await gravity.functions.sendToCosmos(
      testERC20.address,
      ethers.utils.formatBytes32String("myCosmosAddress"),
      1000
    );
    newValset.rewardToken = testERC20.address
    newValset.rewardAmount = 5000000
  }

  const checkpoint = makeCheckpoint(
    newValset.validators,
    newValset.powers,
    newValset.valsetNonce,
    newValset.rewardAmount,
    newValset.rewardToken,
    gravityId
  );

  let sigs = await signHash(validators, checkpoint);
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

  if (opts.malformedCurrentValset) {
    // Remove one of the powers to make the length not match
    powers.pop();
  }


  let valsetUpdateTx = await gravity.updateValset(
    newValset,
    currentValset,
    sigs.v,
    sigs.r,
    sigs.s
  );
  
  // check that the relayer was paid
  if (opts.withReward) {
    // panic if we failed to deploy the contract earlier
    expect(ERC20contract)
    if (ERC20contract) {
        expect(
          await (
            await ERC20contract.functions.balanceOf(await valsetUpdateTx.from)
          )[0].toNumber()
        ).to.equal(5000000);
      }
  }

  return { gravity, checkpoint };
}

describe("updateValset tests", function () {
  it("throws on malformed new valset", async function () {
    await expect(runTest({ malformedNewValset: true })).to.be.revertedWith(
      "Malformed new validator set"
    );
  });

  it("throws on malformed current valset", async function () {
    await expect(runTest({ malformedCurrentValset: true })).to.be.revertedWith(
      "Malformed current validator set"
    );
  });

  it("throws on non matching checkpoint for current valset", async function () {
    await expect(
      runTest({ nonMatchingCurrentValset: true })
    ).to.be.revertedWith(
      "Supplied current validators and powers do not match checkpoint"
    );
  });

  it("throws on new valset nonce not incremented", async function () {
    await expect(runTest({ nonceNotIncremented: true })).to.be.revertedWith(
      "New valset nonce must be greater than the current nonce"
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

  it("throws on bad reward ", async function () {
    await expect(runTest({ badReward: true })).to.be.revertedWith(
      "Address: call to non-contract"
    );
  });

  it("throws on not enough reward ", async function () {
    await expect(runTest({ notEnoughReward: true })).to.be.revertedWith(
      "transfer amount exceeds balance"
    );
  });

  it("pays reward correctly", async function () {
    let {gravity, checkpoint} = await runTest({ withReward: true });
    expect((await gravity.functions.state_lastValsetCheckpoint())[0]).to.equal(checkpoint);
  });

  it("happy path", async function () {
    let { gravity, checkpoint } = await runTest({});
    expect((await gravity.functions.state_lastValsetCheckpoint())[0]).to.equal(checkpoint);
  });
});

// This test produces a hash for the contract which should match what is being used in the Go unit tests. It's here for
// the use of anyone updating the Go tests.
describe("updateValset Go test hash", function () {
  it("produces good hash", async function () {


    // Prep and deploy contract
    // ========================
    const gravityId = ethers.utils.formatBytes32String("foo");
    const methodName = ethers.utils.formatBytes32String("checkpoint");
    // note these are manually sorted, functions in Go and Rust auto-sort
    // but this does not so be aware of the order!
    const validators = ["0xE5904695748fe4A84b40b3fc79De2277660BD1D3",
                        "0xc783df8a850f42e7F7e57013759C285caa701eB6", 
                        "0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4", 
                        ];
    const powers = [3333,3333,3333];



    let newValset = {
      validators: validators,
      powers: powers,
      valsetNonce: 0,
      rewardAmount: 0,
      rewardToken: ZeroAddress
    }

    const checkpoint = makeCheckpoint(
      newValset.validators,
      newValset.powers,
      newValset.valsetNonce,
      newValset.rewardAmount,
      newValset.rewardToken,
      gravityId
    );


    const abiEncodedValset = ethers.utils.defaultAbiCoder.encode(
      [
        "bytes32", // gravityId
        "bytes32", // methodName
        "uint256", // valsetNonce
        "address[]", // validators
        "uint256[]", // powers
        "uint256", // rewardAmount
        "address" // rewardToken
      ],
      [
        gravityId,
        methodName,
        newValset.valsetNonce,
        newValset.validators,
        newValset.powers,
        newValset.rewardAmount,
        newValset.rewardToken,
      ]
    );
    const valsetDigest = ethers.utils.keccak256(abiEncodedValset);

    // these should be equal, otherwise either our abi encoding here
    // or over in test-utils/pure.ts is incorrect
    expect(valsetDigest).equal(checkpoint)

    console.log("elements in Valset digest:", {
      "gravityId": gravityId,
      "validators": validators,
      "powers": powers,
      "valsetNonce": newValset.valsetNonce,
      "rewardAmount": newValset.rewardAmount,
      "rewardToken": newValset.rewardToken
    })
    console.log("abiEncodedValset:", abiEncodedValset)
    console.log("valsetDigest:", valsetDigest)
})});