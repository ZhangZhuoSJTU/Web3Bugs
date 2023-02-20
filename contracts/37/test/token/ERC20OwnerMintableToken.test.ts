import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "../utils/ContractBase";
import { expectRevert } from "../utils/Utils";
import { ERC20OwnerMintable } from "../utils/ERC20OwnerMintable";

describe("Owner Mintable Token", async () => {
  let owner:Signer, user:Signer;
  let token:ERC20OwnerMintable;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    token = await ERC20OwnerMintable.create("ERC20OwnerMintableToken", "Owner Mintable Test Token", "OTEST");
  });

  describe("Deploy", async () =>
  {
    it("Should set the right owner and initial supply", async () =>
    {
      expect(await token.manager()).to.equal(owner.address);
      expect(await token.balanceOf(owner)).to.equal(0);
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should set name and symbol", async () =>
    {
      expect(await token.name()).to.equal("Owner Mintable Test Token");
      expect(await token.symbol()).to.equal("OTEST");
    });
  });

  describe("Mint", async () =>
  {
    it("Should allow Owner to mint to Owner", async () =>
    {
      // owner mints to himself
      await token.mint(owner, owner, 10);
      expect(await token.balanceOf(owner)).to.equal(10);
      expect(await token.totalSupply()).to.equal(10);
    });

    it("Should allow Owner to mint to User", async () =>
    {
      await token.mint(owner, user, 10); // Owner mints to User
      expect(await token.balanceOf(user)).to.equal(10);
      expect(await token.totalSupply()).to.equal(10);
    });

    it("Should not allow Users to mint to User", async () =>
    {
      (await expectRevert(token.mint(user, user, 10))).to.equal("mint: only manager can mint");
    });

    it("Should not allow Users to mint to Owner", async () =>
    {
      (await expectRevert(token.mint(user, owner, 10))).to.equal("mint: only manager can mint");
    });
  });

  describe("Burn", async () =>
  {
    it("Should allow Owner to burn his own tokens", async () =>
    {
      await token.mint(owner, owner, 10); // Owner mints to Owner
      expect(await token.balanceOf(owner)).to.equal(10);
      expect(await token.totalSupply()).to.equal(10);

      await token.burn(owner, 5); // Owner burns Owner
      expect(await token.balanceOf(owner)).to.equal(5);
      expect(await token.totalSupply()).to.equal(5);

      await token.burnFrom(owner, owner, 5);
      expect(await token.balanceOf(owner)).to.equal(0);
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should allow Owner to burn User tokens", async () =>
    {
      await token.mint(owner, user, 8); // Owner mints to User
      expect(await token.balanceOf(user)).to.equal(8);
      expect(await token.totalSupply()).to.equal(8);

      await token.burnFrom(owner, user, 8); // Owner burns User
      expect(await token.balanceOf(user)).to.equal(0);
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should not allow Users to burn their own tokens", async () =>
    {
      await token.mint(owner, user, 10); // Owner mints to User
      expect(await token.balanceOf(user)).to.equal(10);
      expect(await token.totalSupply()).to.equal(10);

      // User tries to burn User tokens
      (await expectRevert(token.burn(user, 5))).to.equal("burn: only manager can burn");
      (await expectRevert(token.burn(user, 10))).to.equal("burn: only manager can burn");
      (await expectRevert(token.burnFrom(user, user, 5))).to.equal("burn: only manager can burn");
      (await expectRevert(token.burnFrom(user, user, 10))).to.equal("burn: only manager can burn");
    });

    it("Should not allow Users to burn Owners tokens", async () =>
    {
      await token.mint(owner, owner, 10); // Owner mints to Owner
      expect(await token.balanceOf(owner)).to.equal(10);
      expect(await token.totalSupply()).to.equal(10);

      // User tries to burn Owner tokens
      (await expectRevert(token.burnFrom(user, owner, 5))).to.equal("burn: only manager can burn");
      (await expectRevert(token.burnFrom(user, owner, 10))).to.equal("burn: only manager can burn");
    });

    it("Should not allow Owner to burn more User tokens than available", async () =>
    {
      await token.mint(owner, user, 5); // Owner mints to User
      expect(await token.balanceOf(user)).to.equal(5);
      expect(await token.totalSupply()).to.equal(5);

      // Owner burns User, but more than exists
      (await expectRevert(token.burnFrom(owner, user, 10))).to.equal("ERC20: burn amount exceeds balance");
    });
  });
});
