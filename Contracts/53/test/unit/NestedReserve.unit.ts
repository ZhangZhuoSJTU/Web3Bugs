import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { appendDecimals } from "../helpers";
import { MockERC20, MockERC20__factory, NestedReserve, NestedReserve__factory } from "../../typechain";

describe("NestedReserve", () => {
    let nestedReserve: NestedReserve__factory, reserve: NestedReserve;
    let mockERC20: MockERC20__factory, mockUNI: MockERC20;
    let factory: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress;

    const amountToTransfer = appendDecimals(10);
    before(async () => {
        nestedReserve = await ethers.getContractFactory("NestedReserve");
        mockERC20 = await ethers.getContractFactory("MockERC20");

        const signers = await ethers.getSigners();
        factory = signers[0] as any;
        alice = signers[1] as any;
        bob = signers[2] as any;
    });

    beforeEach(async () => {
        reserve = await nestedReserve.deploy(factory.address);
        await reserve.deployed();

        mockUNI = await mockERC20.deploy("Mocked UNI", "INU", 0);
        await mockUNI.mint(reserve.address, amountToTransfer);
    });

    describe("#initialization", () => {
        it("sets the state variable", async () => {
            expect(await reserve.factory()).to.eq(factory.address);
        });

        it("sets a new factory", async () => {
            const tx = await reserve.updateFactory(bob.address);
            await tx.wait();
            expect(await reserve.factory()).to.eq(bob.address);
        });

        it("should revert if unauthorized account sets the factory", async () => {
            await expect(reserve.connect(bob).updateFactory(bob.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("should revert if sets the factory with address zero", async () => {
            await expect(reserve.updateFactory(ethers.constants.AddressZero)).to.be.revertedWith(
                "NestedReserve: INVALID_ADDRESS",
            );
        });
    });

    describe("#transfer", async () => {
        it("transfer the funds", async () => {
            await reserve.transfer(alice.address, mockUNI.address, amountToTransfer);
            expect(await mockUNI.balanceOf(alice.address)).to.eq(amountToTransfer);
        });

        it("reverts if insufficient funds", async () => {
            await expect(reserve.transfer(alice.address, mockUNI.address, amountToTransfer.add(1))).to.be.revertedWith(
                "transfer amount exceeds balance",
            );
        });

        it("reverts if the recipient if unauthorized", async () => {
            await expect(
                reserve.connect(alice).transfer(alice.address, mockUNI.address, amountToTransfer),
            ).to.be.revertedWith("NestedReserve: UNAUTHORIZED");
        });

        it("reverts if the token is invalid", async () => {
            await expect(
                reserve.transfer(alice.address, "0x0000000000000000000000000000000000000000", amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS");
        });

        it("reverts if the recipient is invalid", async () => {
            await expect(
                reserve.transfer("0x0000000000000000000000000000000000000000", mockUNI.address, amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS");
        });
    });

    describe("#withdraw", async () => {
        it("transfer the funds", async () => {
            await reserve.withdraw(mockUNI.address, amountToTransfer);
            expect(await mockUNI.balanceOf(factory.address)).to.eq(amountToTransfer);
        });

        it("reverts if insufficient funds", async () => {
            await expect(reserve.withdraw(mockUNI.address, amountToTransfer.add(1))).to.be.revertedWith(
                "transfer amount exceeds balance",
            );
        });

        it("reverts if the recipient if unauthorized", async () => {
            await expect(reserve.connect(alice).withdraw(mockUNI.address, amountToTransfer)).to.be.revertedWith(
                "NestedReserve: UNAUTHORIZED",
            );
        });

        it("reverts if the token is invalid", async () => {
            await expect(
                reserve.withdraw("0x0000000000000000000000000000000000000000", amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS");
        });
    });
});
