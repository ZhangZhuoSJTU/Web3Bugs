import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { Claimers } from "../../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";

describe("Claimers", () => {
  let vault: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let claimers: Claimers;

  beforeEach(async () => {
    [vault, alice, bob, carol] = await ethers.getSigners();

    let Claimers = await ethers.getContractFactory("Claimers");

    claimers = (await Claimers.deploy(vault.address)) as Claimers;
  });

  describe("transferFrom", () => {
    it("transfers the claimer NFT to another account", async () => {
      await claimers.connect(vault).mint(bob.address, 100, 100);
      await claimers.connect(vault).mint(bob.address, 100, 100);

      await claimers.connect(bob).transferFrom(bob.address, carol.address, 1);

      const tokenId = await claimers.addressToTokenID(carol.address);
      const carolPrincipal = await claimers.connect(vault).principalOf(tokenId);

      expect(carolPrincipal.eq(200)).to.be.true;
    });

    it("fails if the destionation address already has an NFT", async () => {
      await claimers.connect(vault).mint(bob.address, 100, 100);
      await claimers.connect(vault).mint(carol.address, 100, 100);

      await expect(
        claimers.connect(bob).transferFrom(bob.address, carol.address, 1)
      ).to.be.revertedWith("Claimers: destination already has an NFT");
    });
  });

  describe("mint", () => {
    it("ensures there's only one NFT per address", async () => {
      const nftID = await claimers.connect(vault).mint(bob.address, 100, 100);
      const nft2ID = await claimers.connect(vault).mint(bob.address, 100, 100);

      expect(nftID.toString()).to.equal(nft2ID.toString());
    });

    it("increments the principal", async () => {
      await claimers.connect(vault).mint(bob.address, 100, 10);
      await claimers.connect(vault).mint(bob.address, 100, 10);

      const tokenId = await claimers.addressToTokenID(bob.address);
      expect(await claimers.principalOf(tokenId)).to.equal(200);
    });

    it("increments the shares", async () => {
      await claimers.connect(vault).mint(bob.address, 100, 200);
      await claimers.connect(vault).mint(bob.address, 100, 200);

      const tokenId = await claimers.addressToTokenID(bob.address);
      expect(await claimers.sharesOf(tokenId)).to.equal(400);
    });

    it("fails when the caller is not the vault", async () => {
      expect(
        claimers.connect(bob).mint(bob.address, 100, 100)
      ).to.be.revertedWith("Claimers: not authorized");
    });
  });
});
