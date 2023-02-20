import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { BN, simpleToExactAmount } from "../test-utils/math";
import { MockAuraMath, MockAuraMath__factory } from "../types/generated";

const MaxUint224 = BN.from(2).pow(224).sub(1);
const MaxUint128 = BN.from(2).pow(128).sub(1);
const MaxUint112 = BN.from(2).pow(112).sub(1);
const MaxUint96 = BN.from(2).pow(96).sub(1);
const MaxUint32 = BN.from(2).pow(32).sub(1);
describe("library AuraMath", () => {
    let accounts: Signer[];
    let deployer: Signer;
    let auraMath: MockAuraMath;
    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        auraMath = await new MockAuraMath__factory(deployer).deploy();
    });

    describe("AuraMath256", () => {
        it("returns the smaller of two numbers", async () => {
            expect(await auraMath.AuraMath_min(1, 2)).to.eq(1);
            expect(await auraMath.AuraMath_min(2, 0)).to.eq(0);
            expect(await auraMath.AuraMath_min(ethers.constants.MaxUint256, 1)).to.eq(1);
            expect(await auraMath.AuraMath_min(2, 2)).to.eq(2);

            await expect(auraMath.AuraMath_min(-1, 0)).to.reverted;
        });
        it("adds two numbers", async () => {
            expect(await auraMath.AuraMath_add(1, 2)).to.eq(3);
            expect(await auraMath.AuraMath_add(2, 1)).to.eq(3);
            expect(await auraMath.AuraMath_add(1, 1)).to.eq(2);
            expect(await auraMath.AuraMath_add(2, 2)).to.eq(4);
            expect(await auraMath.AuraMath_add(ethers.constants.MaxUint256, 0)).to.eq(ethers.constants.MaxUint256);

            await expect(auraMath.AuraMath_add(ethers.constants.MaxUint256, ethers.constants.MaxUint256)).to.reverted;
            await expect(auraMath.AuraMath_add(ethers.constants.MaxUint256, 1)).to.reverted;
        });
        it("subtracts two numbers", async () => {
            expect(await auraMath.AuraMath_sub(2, 1)).to.eq(1);
            expect(await auraMath.AuraMath_sub(300, 100)).to.eq(200);
            expect(await auraMath.AuraMath_sub(ethers.constants.MaxUint256, ethers.constants.MaxUint256)).to.eq(0);
            await expect(auraMath.AuraMath_sub(1, 2), "no negative numbers").to.reverted;
        });
        // multiplies two numbers
        it("multiplies two numbers", async () => {
            expect(await auraMath.AuraMath_mul(1, 2)).to.eq(2);
            expect(await auraMath.AuraMath_mul(2, 1)).to.eq(2);
            expect(await auraMath.AuraMath_mul(ethers.constants.MaxUint256, 1)).to.eq(ethers.constants.MaxUint256);
            await expect(
                auraMath.AuraMath_mul(ethers.constants.MaxUint256, ethers.constants.MaxUint256),
                "panic code 0x11",
            ).to.reverted;
        });
        // divides two numbers
        it("divides two numbers", async () => {
            expect(await auraMath.AuraMath_div(simpleToExactAmount(1), simpleToExactAmount(2)), "rounds number").to.eq(
                0,
            );
            expect(await auraMath.AuraMath_div(2, 1)).to.eq(2);
            expect(await auraMath.AuraMath_div(1, 1)).to.eq(1);
            expect(await auraMath.AuraMath_div(ethers.constants.MaxUint256, ethers.constants.MaxUint256)).to.eq(1);
            await expect(auraMath.AuraMath_div(-1, 2), "no negative numbers").to.reverted;
        });
        // average of two numbers
        it("averages two numbers", async () => {
            // Expects rounded results
            expect(await auraMath.AuraMath_average(simpleToExactAmount(1), 2)).to.eq(simpleToExactAmount(5, 17).add(1));
            expect(await auraMath.AuraMath_average(simpleToExactAmount(30), simpleToExactAmount(10))).to.eq(
                simpleToExactAmount(20),
            );
            expect(await auraMath.AuraMath_average(simpleToExactAmount(10), simpleToExactAmount(10))).to.eq(
                simpleToExactAmount(10),
            );
            // Order  should not matter
            expect(await auraMath.AuraMath_average(simpleToExactAmount(2), simpleToExactAmount(10))).to.eq(
                simpleToExactAmount(6),
            );
            expect(await auraMath.AuraMath_average(simpleToExactAmount(10), simpleToExactAmount(2))).to.eq(
                simpleToExactAmount(6),
            );
        });
        it("to 224 bytes", async () => {
            await expect(auraMath.AuraMath_to224(MaxUint224.add(1))).to.be.revertedWith("AuraMath: uint224 Overflow");
            expect(await auraMath.AuraMath_to224(MaxUint224)).to.eq(MaxUint224);

            expect(await auraMath.AuraMath_to224(simpleToExactAmount(10))).to.eq(simpleToExactAmount(10));
            expect(await auraMath.AuraMath_to224(2)).to.eq(2);
            await expect(auraMath.AuraMath_to224(-10)).to.reverted;
        });
        it("to 128 bytes", async () => {
            await expect(auraMath.AuraMath_to128(MaxUint128.add(1))).to.be.revertedWith("AuraMath: uint128 Overflow");
            expect(await auraMath.AuraMath_to128(MaxUint128)).to.eq(MaxUint128);

            expect(await auraMath.AuraMath_to128(simpleToExactAmount(10))).to.eq(simpleToExactAmount(10));
            expect(await auraMath.AuraMath_to128(2)).to.eq(2);
            await expect(auraMath.AuraMath_to128(-10)).to.reverted;
        });
        it("to 112 bytes", async () => {
            await expect(auraMath.AuraMath_to112(MaxUint112.add(1))).to.be.revertedWith("AuraMath: uint112 Overflow");
            expect(await auraMath.AuraMath_to112(MaxUint112)).to.eq(MaxUint112);

            expect(await auraMath.AuraMath_to112(simpleToExactAmount(10))).to.eq(simpleToExactAmount(10));
            expect(await auraMath.AuraMath_to112(2)).to.eq(2);
            await expect(auraMath.AuraMath_to112(-100)).to.reverted;
        });
        it("to 96 bytes", async () => {
            await expect(auraMath.AuraMath_to96(MaxUint96.add(1))).to.be.revertedWith("AuraMath: uint96 Overflow");
            expect(await auraMath.AuraMath_to96(MaxUint96)).to.eq(MaxUint96);

            expect(await auraMath.AuraMath_to96(simpleToExactAmount(10))).to.eq(simpleToExactAmount(10));
            expect(await auraMath.AuraMath_to96(2)).to.eq(2);
            await expect(auraMath.AuraMath_to96(-1000)).to.reverted;
        });
        it("to 32 bytes", async () => {
            await expect(auraMath.AuraMath_to32(MaxUint32.add(1))).to.be.revertedWith("AuraMath: uint32 Overflow");
            expect(await auraMath.AuraMath_to32(MaxUint32)).to.eq(MaxUint32);
            expect(await auraMath.AuraMath_to32(4294967290)).to.eq(4294967290);
            await expect(auraMath.AuraMath_to32(-10000)).to.reverted;
        });
    });
    describe("AuraMath224", () => {
        it("adds two numbers", async () => {
            expect(await auraMath.AuraMath224_add(1, 2)).to.eq(3);
            expect(await auraMath.AuraMath224_add(2, 1)).to.eq(3);
            expect(await auraMath.AuraMath224_add(simpleToExactAmount(1), simpleToExactAmount(1))).to.eq(
                simpleToExactAmount(2),
            );
            expect(await auraMath.AuraMath224_add(2, 2)).to.eq(4);
            expect(await auraMath.AuraMath224_add(MaxUint224, 0)).to.eq(MaxUint224);

            await expect(auraMath.AuraMath224_add(MaxUint224, MaxUint224)).to.reverted;
            await expect(auraMath.AuraMath224_add(MaxUint224, 1)).to.reverted;
        });
    });
    describe("AuraMath112", () => {
        it("adds two numbers", async () => {
            expect(await auraMath.AuraMath112_add(1, 2)).to.eq(3);
            expect(await auraMath.AuraMath112_add(2, 1)).to.eq(3);
            expect(await auraMath.AuraMath112_add(simpleToExactAmount(1), simpleToExactAmount(1))).to.eq(
                simpleToExactAmount(2),
            );
            expect(await auraMath.AuraMath112_add(2, 2)).to.eq(4);
            expect(await auraMath.AuraMath112_add(MaxUint112, 0)).to.eq(MaxUint112);

            await expect(auraMath.AuraMath112_add(MaxUint112, MaxUint112)).to.reverted;
            await expect(auraMath.AuraMath112_add(MaxUint112, 1)).to.reverted;
        });

        it("subtracts two numbers", async () => {
            expect(await auraMath.AuraMath112_sub(MaxUint112, 0)).to.eq(MaxUint112);
            expect(await auraMath.AuraMath112_sub(300, 100)).to.eq(200);
            await expect(auraMath.AuraMath112_sub(1, 2), "no negative numbers").to.reverted;
            await expect(auraMath.AuraMath112_sub(MaxUint112.add(1), 2), "value out-of-bounds").to.reverted;
        });
    });
    describe("AuraMath32", () => {
        it("subtracts two numbers", async () => {
            expect(await auraMath.AuraMath32_sub(MaxUint32, 0)).to.eq(MaxUint32);
            expect(await auraMath.AuraMath32_sub(300, 100)).to.eq(200);
            await expect(auraMath.AuraMath32_sub(1, 2), "no negative numbers").to.reverted;
            await expect(auraMath.AuraMath32_sub(MaxUint32.add(1), 2), "value out-of-bounds").to.reverted;
        });
    });
});
