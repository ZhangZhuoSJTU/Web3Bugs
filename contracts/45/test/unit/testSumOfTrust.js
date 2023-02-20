const {ethers} = require("hardhat");
require("chai").should();

describe("SumOfTrust Contract using hardhat", () => {
    let ADMIN_SIGNER, ADMIN_ADDRESS;
    let creditLimitModel;
    before(async function () {
        [ADMIN_SIGNER] = await ethers.getSigners();
        ADMIN_ADDRESS = await ADMIN_SIGNER.getAddress();
        const SumOfTrust = await ethers.getContractFactory("SumOfTrust");
        creditLimitModel = await SumOfTrust.connect(ADMIN_SIGNER).deploy(3);
    });

    it("Is credit limit model", async () => {
        const isCreditLimitModel = await creditLimitModel.isCreditLimitModel();
        isCreditLimitModel.should.eq(true);
    });

    it("Should have 0 credit when backed by members < 3", async () => {
        const limit = await creditLimitModel.getCreditLimit([
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("100")
        ]);
        limit.toString().should.eq("0");
    });

    it("Should have the sum number of all vouching amount", async () => {
        const vouchAmount1 = ethers.utils.parseEther("0.001");
        const vouchAmount2 = ethers.utils.parseEther("200.5");
        const vouchAmount3 = ethers.utils.parseEther("500");
        const totalAmount = ethers.utils.parseEther("700.501");

        const limit = await creditLimitModel.getCreditLimit([vouchAmount1, vouchAmount2, vouchAmount3]);
        limit.toString().should.eq(totalAmount.toString());
    });

    it("Should have the sum number of all vouching amount", async () => {
        const vouchAmount1 = ethers.utils.parseEther("0.001");
        const vouchAmount2 = ethers.utils.parseEther("200.5");
        const vouchAmount3 = ethers.utils.parseEther("500");
        const totalAmount = ethers.utils.parseEther("700.501");

        const limit = await creditLimitModel.getCreditLimit([vouchAmount1, vouchAmount2, vouchAmount3]);
        limit.toString().should.eq(totalAmount.toString());
    });

    it("Set effect number", async () => {
        await creditLimitModel.setEffectNumber(1);
        const effectiveNumber = await creditLimitModel.effectiveNumber();
        effectiveNumber.toString().should.eq("1");
    });

    it("Test locked amount", async () => {
        let array = [[ADMIN_ADDRESS, 10, 0, 10]];
        let borrow = 2;

        let limit = await creditLimitModel.getLockedAmount(array, ADMIN_ADDRESS, borrow, true);
        limit.toString().should.eq("2");

        borrow = 10;
        limit = await creditLimitModel.getLockedAmount(array, ADMIN_ADDRESS, borrow, true);
        limit.toString().should.eq("10");

        borrow = 14;
        limit = await creditLimitModel.getLockedAmount(array, ADMIN_ADDRESS, borrow, true);
        limit.toString().should.eq("10");

        limit = await creditLimitModel.getLockedAmount([], ADMIN_ADDRESS, 0, true);
        limit.toString().should.eq("0");

        array = [
            ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "10000000000000000000", "0", "20000000000000000000"],
            ["0xd03ea8624C8C5987235048901fB614fDcA89b117", "10000000000000000000", "0", "10000000000000000000"],
            ["0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC", "10000000000000000000", "0", "10000000000000000000"]
        ];

        borrow = "30000000000000000000";
        limit = await creditLimitModel.getLockedAmount(
            array,
            "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
            borrow,
            true
        );
        limit.toString().should.eq("10000000000000000000");

        array = [
            ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "10000000000000000000", "0", "8000000000000000000"],
            ["0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b", "10000000000000000000", "0", "10000000000000000000"],
            ["0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d", "10000000000000000000", "0", "10000000000000000000"]
        ];

        borrow = "2000000000000000000";
        limit = await creditLimitModel.getLockedAmount(
            array,
            "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            borrow,
            true
        );
        limit.toString().should.eq("0");

        array = [
            ["0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d", "10000000000000000000", "0", "10000000000000000000"],
            ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "10000000000000000000", "10000000000000000000", "0"],
            ["0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b", "10000000000000000000", "0", "10000000000000000000"]
        ];

        borrow = "2000000000000000000";
        limit = await creditLimitModel.getLockedAmount(
            array,
            "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            borrow,
            true
        );
        limit.toString().should.eq("0");

        limit = await creditLimitModel.getLockedAmount(
            array,
            "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            borrow,
            false
        );
        limit.toString().should.eq("0");

        array = [
            ["0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d", "10", "0", "10"],
            ["0x7a0C61EdD8b5c0c5C1437AEb571d7DDbF8022Be4", "20", "0", "1"],
            ["0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0", "20", "0", "20"],
            ["0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b", "15", "0", "15"]
        ];
        limit = await creditLimitModel.getLockedAmount(
            array,
            "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            borrow,
            true
        );
        limit.toString().should.eq("15");
        limit = await creditLimitModel.getLockedAmount(
            array,
            "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            borrow,
            false
        );
        limit.toString().should.eq("0");
    });
});
