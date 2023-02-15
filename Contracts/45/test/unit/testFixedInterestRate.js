const {ethers, upgrades} = require("hardhat");

require("chai").should();

describe("InterestRatemodel Contract", () => {
    let interestRateModel;

    before(async function () {
        const FixedInterestRateModel = await ethers.getContractFactory("FixedInterestRateModel");
        interestRateModel = await FixedInterestRateModel.deploy(0);
    });

    it("Is interest rate model", async () => {
        const isInterestRateModel = await interestRateModel.isInterestRateModel();
        isInterestRateModel.should.eq(true);
    });

    it("Test borrow rate", async () => {
        await interestRateModel.setInterestRate("100000000000000000");
        const rate = await interestRateModel.getBorrowRate();
        rate.toString().should.eq("100000000000000000");
    });
});
