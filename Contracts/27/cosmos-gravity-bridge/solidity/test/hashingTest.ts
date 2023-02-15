import chai from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { HashingTest } from "../typechain/HashingTest";
import { BigNumberish } from "ethers";

import { deployContracts } from "../test-utils";
import { getSignerAddresses } from "../test-utils/pure";

chai.use(solidity);
const { expect } = chai;

describe("Hashing test", function() {
  it("Hashing test", async function() {
    const signers = await ethers.getSigners();
    const gravityId = ethers.utils.formatBytes32String("foo");

    let validators = [];
    let powers = [];

    for (let i = 0; i < 100; i++) {
      validators.push(signers[i]);
      powers.push(5000);
    }

    const HashingTest = await ethers.getContractFactory("HashingTest");

    const hashingContract = (await HashingTest.deploy()) as HashingTest;

    await hashingContract.deployed();

    await hashingContract.IterativeHash(
      await getSignerAddresses(validators),
      powers,
      1,
      gravityId
    );

    await hashingContract.ConcatHash(
      await getSignerAddresses(validators),
      powers,
      1,
      gravityId
    );

    await hashingContract.ConcatHash2(
      await getSignerAddresses(validators),
      powers,
      1,
      gravityId
    );

    const contractCheckpoint = await hashingContract.lastCheckpoint();
    const externalCheckpoint = makeCheckpoint(
      await getSignerAddresses(validators),
      powers,
      1,
      gravityId
    );

    expect(contractCheckpoint === externalCheckpoint);

    await hashingContract.JustSaveEverything(
      await getSignerAddresses(validators),
      powers,
      1
    );

    await hashingContract.JustSaveEverythingAgain(
      await getSignerAddresses(validators),
      powers,
      1
    );
  });
});

export function makeCheckpoint(
  validators: string[],
  powers: BigNumberish[],
  valsetNonce: BigNumberish,
  gravityId: string
) {
  const methodName = ethers.utils.formatBytes32String("checkpoint");

  let abiEncoded = ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "uint256", "address[]", "uint256[]"],
    [gravityId, methodName, valsetNonce, validators, powers]
  );

  let checkpoint = ethers.utils.keccak256(abiEncoded);

  return checkpoint;
}
