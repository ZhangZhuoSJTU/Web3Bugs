import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { ContractFactory } from "@ethersproject/contracts";

describe("AaveVaultFactory", () => {
    let someSigner: Signer;
    let factory: ContractFactory;

    beforeEach(async () => {
        [someSigner] = await ethers.getSigners();
        factory = await ethers.getContractFactory("DefaultAccessControl");
    });

    describe("constructor", () => {
        describe("when passed zero address", () => {
            it("reverts", async () => {
                await expect(
                    factory.deploy(ethers.constants.AddressZero)
                ).to.be.revertedWith("ZADM");
            });
        });

        describe("when passed something else", () => {
            it("passes", async () => {
                await expect(factory.deploy(await someSigner.getAddress())).to
                    .not.be.reverted;
            });
        });
    });
});
