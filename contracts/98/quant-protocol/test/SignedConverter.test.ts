import { assert } from "chai";
import { ethers } from "hardhat";
import { SignedConverterTester } from "../typechain";
import { expect } from "./setup";

describe("SignedConverter lib", () => {
  let lib: SignedConverterTester;

  before("set up contracts", async () => {
    const SignedConverterTesterArtifact = await ethers.getContractFactory(
      "SignedConverterTester"
    );
    lib = <SignedConverterTester>await SignedConverterTesterArtifact.deploy();
  });

  describe("Test type conversion", () => {
    it("Should convert from unsigned integer to signed integer", async () => {
      const uint = 5;
      const expectedInt = 5;

      assert.equal(
        (await lib.testFromUint(uint)).toNumber(),
        expectedInt,
        "conversion from uint to int mismatch"
      );
    });

    it("It should revert converting an unsigned integer greater than 2^255  signed integer", async () => {
      const uint =
        "57896044618658097711785492504343953926634992332820282019728792003956564819968"; // 2**255
      await expect(lib.testFromUint(uint)).to.be.revertedWith(
        "QuantMath: out of int range"
      );

      const uint2 =
        "57896044618658097711785492504343953926634992332820282019728792003956564819969"; // 2 ** 255 + 1;
      await expect(lib.testFromUint(uint2)).to.be.revertedWith(
        "QuantMath: out of int range"
      );
    });

    it("Should convert max_int (2^255) - 1 from uint to int", async () => {
      const uint =
        "5789604461865809771178549250434395392663499233282028201972879200395656481996"; //2 ** 255 - 1;
      assert.equal(
        (await lib.testFromUint(uint)).toString(),
        uint.toString(),
        "conversion from int to uint mismatch"
      );
    });

    it("Should convert from signed integer to unsigned integer", async () => {
      const int = -3;
      const expectedUint = 3;

      assert.equal(
        (await lib.testFromInt(int)).toNumber(),
        expectedUint,
        "conversion from int to uint mismatch"
      );
    });
    it("Should convert from positive signed integer to unsigned integer", async () => {
      const int = 3;
      const expectedUint = 3;

      assert.equal(
        (await lib.testFromInt(int)).toNumber(),
        expectedUint,
        "conversion from int to uint mismatch"
      );
    });
  });
});
