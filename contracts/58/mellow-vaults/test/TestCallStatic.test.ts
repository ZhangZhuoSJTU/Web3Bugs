import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";

describe("TestCallStatic", () => {
    let c: Contract;

    before(async () => {
        c = await (await ethers.getContractFactory("TestCallStatic")).deploy();
    });

    describe("incA", () => {
        it("passes", async () => {
            expect(await c.callStatic.incA()).to.be.equals(1);
            expect(await c.a()).to.be.equals(0);
            await c.incA();
            expect(await c.a()).to.be.equals(1);
        });
    });
});
