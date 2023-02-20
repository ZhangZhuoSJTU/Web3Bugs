import { expect } from "chai";
import { ethers } from "hardhat";
import { ActionsTester } from "../typechain";
import {
  encodeCollateralTokenApprovalArgs,
  encodeQTokenPermitArgs,
} from "./actionsUtils";
import { ActionType } from "./testUtils";
const { AddressZero, Zero, HashZero } = ethers.constants;

describe("Actions lib", () => {
  let lib: ActionsTester;
  const amount = ethers.BigNumber.from("10");

  before("setup contracts", async () => {
    const ActionsTesterArtifact = await ethers.getContractFactory(
      "ActionsTester"
    );
    lib = <ActionsTester>await ActionsTesterArtifact.deploy();
  });

  describe("Test parseMintOptionArgs", () => {
    it("Should revert when passing 0 as the amount", async () => {
      await expect(
        lib.testParseMintOptionArgs({
          actionType: ActionType.MintOption,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount: 0,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.revertedWith("Actions: cannot mint 0 options");
    });

    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseMintOptionArgs({
          actionType: ActionType.MintOption,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.deep.equal([AddressZero, AddressZero, amount]);
    });
  });

  describe("Test parseMintSpreadArgs", () => {
    it("Should revert when passing 0 as the amount", async () => {
      await expect(
        lib.testParseMintSpreadArgs({
          actionType: ActionType.MintSpread,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount: 0,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.revertedWith("Actions: cannot mint 0 options from spreads");
    });

    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseMintSpreadArgs({
          actionType: ActionType.MintSpread,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.deep.equal([AddressZero, AddressZero, amount]);
    });
  });

  describe("Test parseExerciseArgs", () => {
    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseExerciseArgs({
          actionType: ActionType.Exercise,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.deep.equal([AddressZero, amount]);
    });
  });

  describe("Test parseClaimCollateralArgs", () => {
    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseClaimCollateralArgs({
          actionType: ActionType.ClaimCollateral,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.deep.equal([Zero, amount]);
    });
  });

  describe("Test parseNeutralizeArgs", () => {
    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseNeutralizeArgs({
          actionType: ActionType.Neutralize,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.deep.equal([Zero, amount]);
    });
  });

  describe("Test parseQTokenPermitArgs", () => {
    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseQTokenPermitArgs(
          encodeQTokenPermitArgs({
            qToken: AddressZero,
            owner: AddressZero,
            spender: AddressZero,
            value: amount,
            deadline: Zero,
            v: Zero,
            r: HashZero,
            s: HashZero,
          })
        )
      ).to.be.deep.equal([
        AddressZero,
        AddressZero,
        AddressZero,
        amount,
        Zero,
        0,
        HashZero,
        HashZero,
      ]);
    });
  });

  describe("Test parseCollateralTokenApprovalArgs", () => {
    it("Should parse valid parameters correctly", async () => {
      expect(
        await lib.testParseCollateralTokenApprovalArgs(
          encodeCollateralTokenApprovalArgs({
            owner: AddressZero,
            operator: AddressZero,
            approved: true,
            nonce: amount,
            deadline: Zero,
            v: Zero,
            r: HashZero,
            s: HashZero,
          })
        )
      ).to.be.deep.equal([
        AddressZero,
        AddressZero,
        true,
        amount,
        Zero,
        0,
        HashZero,
        HashZero,
      ]);
    });
  });

  describe("Test parseCallArgs", () => {
    it("Should revert when passing the zero address as the receiver (callee)", async () => {
      await expect(
        lib.testParseCallArgs({
          actionType: ActionType.Call,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: AddressZero,
          amount,
          collateralTokenId: 0,
          data: "0x",
        })
      ).to.be.revertedWith("Actions: cannot make calls to the zero address");
    });

    it("Should parse valid parameters correctly", async () => {
      const callee = ethers.Wallet.createRandom().address;
      const data = "0xd6cafe";
      expect(
        await lib.testParseCallArgs({
          actionType: ActionType.Call,
          qToken: AddressZero,
          secondaryAddress: AddressZero,
          receiver: callee,
          amount: 0,
          collateralTokenId: 0,
          data,
        })
      ).to.be.deep.equal([callee, data]);
    });
  });
});
