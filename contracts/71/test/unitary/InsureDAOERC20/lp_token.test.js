const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { ZERO_ADDRESS } = require("../constant-utils");

const name = "My Token";
const symbol = "MTKN";

describe("InsuerDAOERC20", function () {
  beforeEach(async () => {
    [creator, alice, bob, chad, tom] = await ethers.getSigners();
    //[initialHolder, recipient, anotherAccount] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("InsureDAOERC20Mock");
    token = await ERC20Mock.deploy();
    await token.initialize(name, symbol, 18);

    //console.log(initialHolder, recipient);
  });

  describe("ERC20", function () {
    beforeEach(async () => {
      await token.mint(alice.address, 10000);
      await token.mint(bob.address, 10000);
      await token.mint(chad.address, 10000);
    });
    describe("metadata", function () {
      it("has a name", async function () {
        expect(await token.name()).to.equal(name);
      });

      it("has a symbol", async function () {
        expect(await token.symbol()).to.equal(symbol);
      });

      it("has 18 decimals", async function () {
        expect(await token.decimals()).to.equal(18);
      });
    });
    describe("allowance", function () {
      it("returns no allowance", async function () {
        expect(await token.allowance(alice.address, tom.address)).to.equal("0");
      });
      it("approve/ increases/ decrease change allowance", async function () {
        await token.connect(alice).approve(tom.address, 5000);
        expect(await token.allowance(alice.address, tom.address)).to.equal(
          "5000"
        );
        await token.connect(alice).decreaseAllowance(tom.address, "5000");
        expect(await token.allowance(alice.address, tom.address)).to.equal("0");
        await token.connect(alice).increaseAllowance(tom.address, "10000");
        expect(await token.allowance(alice.address, tom.address)).to.equal(
          "10000"
        );
      });
      it("declines to decrease allowance more than approval", async function () {
        await token.connect(alice).approve(tom.address, 5000);
        await expect(
          token.connect(alice).decreaseAllowance(tom.address, "10000")
        ).to.revertedWith("ERC20: decreased allowance below zero");
      });
    });
    describe("total supply", function () {
      it("returns the total amount of tokens", async function () {
        expect(await token.totalSupply()).to.equal("30000");
      });
    });
    describe("balanceOf", function () {
      context("when the requested account has no tokens", function () {
        it("returns zero", async function () {
          expect(await token.balanceOf(tom.address)).to.equal("0");
        });
      });

      context("when the requested account has some tokens", function () {
        it("returns the total amount of tokens", async function () {
          expect(await token.balanceOf(alice.address)).to.equal("10000");
        });
      });
    });
    describe("transfer", function () {
      context("when the recipient is not the zero address", function () {
        context("when the sender does not have enough balance", function () {
          it("reverts", async function () {
            await expect(
              token.connect(alice).transfer(tom.address, "10001")
            ).to.reverted;
          });
        });

        context("when the sender has enough balance", function () {
          it("transfers the requested amount", async function () {
            await token.connect(alice).transfer(tom.address, "10000");
            expect(await token.balanceOf(alice.address)).to.equal("0");
            expect(await token.balanceOf(tom.address)).to.equal("10000");
          });
        });
      });

      context("when the recipient is the zero address", function () {
        it("reverts", async function () {
          await expect(
            token.connect(tom).transfer(ZERO_ADDRESS, 10000)
          ).to.revertedWith("ERC20: transfer to the zero address");
        });
      });
    });
    describe("transferFrom", function () {
      context("when the recipient is not the zero address", function () {
        context("when the sender does not have enough balance", function () {
          it("reverts", async function () {
            await token.connect(alice).approve(tom.address, 10000);
            await expect(
              token
                .connect(alice)
                .transferFrom(alice.address, tom.address, "10001")
            ).to.reverted;
          });
        });
        context("when the transfer amount exceeds allowance", function () {
          it("reverts", async function () {
            await token.connect(alice).approve(tom.address, 5000);
            await expect(
              token
                .connect(tom)
                .transferFrom(alice.address, tom.address, "6000")
            ).to.revertedWith("ERC20: transfer amount exceeds allowance");
          });
        });
        context("when the transfer amount exceeds balance", function () {
          it("reverts", async function () {
            await token.connect(alice).approve(tom.address, 20000);
            await expect(
              token
                .connect(tom)
                .transferFrom(alice.address, tom.address, "10001")
            ).to.revertedWith("ERC20: transfer amount exceeds balance");
          });
        });
        context("when the sender has enough balance", function () {
          it("transfers the requested amount", async function () {
            await token.connect(alice).approve(tom.address, 10000);
            await token
              .connect(tom)
              .transferFrom(alice.address, tom.address, "10000");
            expect(await token.balanceOf(alice.address)).to.equal("0");
            expect(await token.balanceOf(tom.address)).to.equal("10000");
          });
        });
      });
      context("when the recipient is the zero address", function () {
        it("reverts", async function () {
          await token.connect(alice).approve(tom.address, 10000);
          await expect(
            token.connect(tom).transferFrom(alice.address, ZERO_ADDRESS, 10000)
          ).to.revertedWith("ERC20: transfer to the zero address");
        });
      });
    });
    describe("mint", function () {
      context("trying to mint to zero address", function () {
        it("reverts", async function () {
          await expect(token.mint(ZERO_ADDRESS, "10001")).to.revertedWith(
            "ERC20: mint to the zero address"
          );
        });
      });
    });
    describe("burn", function () {
      context("when the requested account has enough tokens", function () {
        it("returns zero", async function () {
          expect(await token.balanceOf(alice.address)).to.equal("10000");
          await token.connect(alice).burn("10000");
          expect(await token.balanceOf(alice.address)).to.equal("0");
        });
      });

      context("when the requested account has not enough tokens", function () {
        it("reverts", async function () {
          await expect(token.connect(alice).burn("10001")).to.revertedWith(
            "ERC20: burn amount exceeds balance"
          );
        });
      });
    });
  });
});
