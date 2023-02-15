const {ethers, upgrades} = require("hardhat");

require("chai").should();

describe("Test floor, ceiling and withdraw sequence of money market adaptors", () => {
    const adminMintAmount = ethers.utils.parseEther("100000");
    const aFloorAmount = ethers.utils.parseEther("100");
    const bFloorAmount = ethers.utils.parseEther("200");
    const cFloorAmount = ethers.utils.parseEther("300");
    const aCeilingAmount = ethers.utils.parseEther("3000");
    const bCeilingAmount = ethers.utils.parseEther("2000");
    const cCeilingAmount = ethers.utils.parseEther("1000");

    let admin;
    let assetManager, dai, aDAI, bDAI, cDAI, aAdaptor, bAdaptor, cAdaptor;

    const deployAndInitContracts = async () => {
        dai = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), ["Dai Stablecoin", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        await dai.mint(admin.getAddress(), adminMintAmount);

        // setting default sender as user manager on mock market registry so we can deposit and withdraw while testing
        const MarketRegistry = await ethers.getContractFactory("MarketRegistryMock");
        const marketRegistry = await MarketRegistry.deploy(admin.getAddress());

        //mock user address is uToken to call assetmanager
        await marketRegistry.addUToken(dai.address, admin.address);

        assetManager = await upgrades.deployProxy(
            await ethers.getContractFactory("AssetManager"),
            [marketRegistry.address],
            {initializer: "__AssetManager_init(address)"}
        );
        await assetManager.addToken(dai.address);

        const CompoundMock = await ethers.getContractFactory("CompoundMock");
        aDAI = await CompoundMock.deploy();
        await aDAI["__CompoundMock_init(uint256,address)"](ethers.utils.parseEther("0.01"), dai.address);

        bDAI = await CompoundMock.deploy();
        await bDAI["__CompoundMock_init(uint256,address)"](ethers.utils.parseEther("0.01"), dai.address);

        cDAI = await CompoundMock.deploy();
        await cDAI["__CompoundMock_init(uint256,address)"](ethers.utils.parseEther("0.01"), dai.address);

        aAdaptor = await upgrades.deployProxy(
            await ethers.getContractFactory("CompoundAdapter"),
            [assetManager.address],
            {initializer: "__CompoundAdapter_init(address)"}
        );
        await aAdaptor.setFloor(dai.address, aFloorAmount);
        await aAdaptor.setCeiling(dai.address, aCeilingAmount);
        await aAdaptor.mapTokenToCToken(dai.address, aDAI.address);
        await assetManager.addAdapter(aAdaptor.address);

        bAdaptor = await upgrades.deployProxy(
            await ethers.getContractFactory("CompoundAdapter"),
            [assetManager.address],
            {initializer: "__CompoundAdapter_init(address)"}
        );
        await bAdaptor.setFloor(dai.address, bFloorAmount);
        await bAdaptor.setCeiling(dai.address, bCeilingAmount);
        await bAdaptor.mapTokenToCToken(dai.address, bDAI.address);
        await assetManager.addAdapter(bAdaptor.address);

        cAdaptor = await upgrades.deployProxy(
            await ethers.getContractFactory("CompoundAdapter"),
            [assetManager.address],
            {initializer: "__CompoundAdapter_init(address)"}
        );
        await cAdaptor.setFloor(dai.address, cFloorAmount);
        await cAdaptor.setCeiling(dai.address, cCeilingAmount);
        await cAdaptor.mapTokenToCToken(dai.address, cDAI.address);
        await assetManager.addAdapter(cAdaptor.address);
    };

    const bootstrapAdaptors =
        ({initAmountA, initAmountB, initAmountC}) =>
        async () => {
            if (initAmountA) {
                await dai.transfer(aAdaptor.address, initAmountA);
                await aAdaptor.deposit(dai.address);
            }
            if (initAmountB) {
                await dai.transfer(bAdaptor.address, initAmountB);
                await bAdaptor.deposit(dai.address);
            }
            if (initAmountC) {
                await dai.transfer(cAdaptor.address, initAmountC);
                await cAdaptor.deposit(dai.address);
            }
        };

    const FLOOR = "floor";
    const CEILING = "ceiling";
    const checkSupply = async ({adaptor, checks}) => {
        await Promise.all(
            Object.keys(checks).map(async op => {
                const value = checks[op];
                let amount;
                switch (value) {
                    case FLOOR:
                        amount = await adaptor.floorMap(dai.address);
                        break;
                    case CEILING:
                        amount = await adaptor.ceilingMap(dai.address);
                        break;
                    default:
                        amount = value;
                        break;
                }
                const supply = await adaptor.getSupplyView(dai.address);
                supply.should.be[op](amount);
            })
        );
    };

    const checkSupplyA = checks => async () => {
        await checkSupply({adaptor: aAdaptor, checks});
    };
    const checkSupplyB = checks => async () => {
        await checkSupply({adaptor: bAdaptor, checks});
    };
    const checkSupplyC = checks => async () => {
        await checkSupply({adaptor: cAdaptor, checks});
    };

    const depositDAI =
        ({amount}) =>
        async () => {
            await dai.approve(assetManager.address, amount);
            await assetManager.deposit(dai.address, amount);
        };

    const withdrawDAI =
        ({amount}) =>
        async () => {
            await assetManager.withdraw(dai.address, admin.getAddress(), amount);
        };

    before(async () => {
        [admin] = await ethers.getSigners();
    });

    describe("Deposit when none of the floors are filled", () => {
        const initAmountA = ethers.utils.parseEther("40");
        const initAmountB = ethers.utils.parseEther("60");
        const initAmountC = ethers.utils.parseEther("80");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be less than floor", checkSupplyA({lt: FLOOR}));
        it("Supply of B should be less than floor", checkSupplyB({lt: FLOOR}));
        it("Supply of C should be less than floor", checkSupplyC({lt: FLOOR}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in A", checkSupplyA({eq: initAmountA.add(depositAmount)}));
    });

    describe("Deposit when floor A is filled and floor B, C are not filled", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("60");
        const initAmountC = ethers.utils.parseEther("80");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be greater than floor", checkSupplyA({gt: FLOOR}));
        it("Supply of B should be less than floor", checkSupplyB({lt: FLOOR}));
        it("Supply of C should be less than floor", checkSupplyC({lt: FLOOR}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in B", checkSupplyB({eq: initAmountB.add(depositAmount)}));
    });

    describe("Deposit when floor A, B are filled and floor C is not filled", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("260");
        const initAmountC = ethers.utils.parseEther("80");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be greater than floor", checkSupplyA({gt: FLOOR}));
        it("Supply of B should be greater than floor", checkSupplyB({gt: FLOOR}));
        it("Supply of C should be less than floor", checkSupplyC({lt: FLOOR}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in C", checkSupplyC({eq: initAmountC.add(depositAmount)}));
    });

    describe("Deposit when all floors are filled and no ceilings are filled", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("260");
        const initAmountC = ethers.utils.parseEther("380");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be between floor and ceiling", checkSupplyB({gt: FLOOR, lt: CEILING}));
        it("Supply of C should be between floor and ceiling", checkSupplyC({gt: FLOOR, lt: CEILING}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in C", checkSupplyC({eq: initAmountC.add(depositAmount)}));
    });

    describe("Deposit when ceiling C is filled and ceiling A, B are not filled", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("260");
        const initAmountC = ethers.utils.parseEther("1000");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be between floor and ceiling", checkSupplyB({gt: FLOOR, lt: CEILING}));
        it("Supply of C should be equal to ceiling", checkSupplyC({eq: CEILING}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in B", checkSupplyB({eq: initAmountB.add(depositAmount)}));
    });

    describe("Deposit when ceiling B, C are filled and ceiling A is not filled", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("2000");
        const initAmountC = ethers.utils.parseEther("1000");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be equal to ceiling", checkSupplyB({eq: CEILING}));
        it("Supply of C should be equal to ceiling", checkSupplyC({eq: CEILING}));

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in A", checkSupplyA({eq: initAmountA.add(depositAmount)}));
    });

    describe("Deposit when all floors are filled, no ceilings are filled and deposit size crosses ceiling C", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("260");
        const initAmountC = ethers.utils.parseEther("380");
        const depositAmount = ethers.utils.parseEther("1000");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be between floor and ceiling", checkSupplyB({gt: FLOOR, lt: CEILING}));
        it("Supply of C should be between floor and ceiling", checkSupplyC({gt: FLOOR, lt: CEILING}));
        it("Deposit size should exceed C ceiling", async () => {
            const supply = await cAdaptor.getSupplyView(dai.address);
            const ceiling = await cAdaptor.ceilingMap(dai.address);
            supply.add(depositAmount).should.be.gt(ceiling);
        });

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in B", checkSupplyB({eq: initAmountB.add(depositAmount)}));
    });

    describe("Deposit when all floors are filled, no ceilings are filled and deposit size crosses ceiling B, C", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("260");
        const initAmountC = ethers.utils.parseEther("380");
        const depositAmount = ethers.utils.parseEther("2000");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be between floor and ceiling", checkSupplyB({gt: FLOOR, lt: CEILING}));
        it("Supply of C should be between floor and ceiling", checkSupplyC({gt: FLOOR, lt: CEILING}));
        it("Deposit size should exceed C ceiling", async () => {
            const supply = await cAdaptor.getSupplyView(dai.address);
            const ceiling = await cAdaptor.ceilingMap(dai.address);
            supply.add(depositAmount).should.be.gt(ceiling);
        });
        it("Deposit size should exceed B ceiling", async () => {
            const supply = await bAdaptor.getSupplyView(dai.address);
            const ceiling = await bAdaptor.ceilingMap(dai.address);
            supply.add(depositAmount).should.be.gt(ceiling);
        });

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in A", checkSupplyA({eq: initAmountA.add(depositAmount)}));
    });

    describe("Deposit when all floors are filled, only ceiling B is filled and deposit size crosses ceiling C", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("2000");
        const initAmountC = ethers.utils.parseEther("380");
        const depositAmount = ethers.utils.parseEther("1000");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be equal to ceiling", checkSupplyB({eq: CEILING}));
        it("Supply of C should be between floor and ceiling", checkSupplyC({gt: FLOOR, lt: CEILING}));
        it("Deposit size should exceed C ceiling", async () => {
            const supply = await cAdaptor.getSupplyView(dai.address);
            const ceiling = await cAdaptor.ceilingMap(dai.address);
            supply.add(depositAmount).should.be.gt(ceiling);
        });

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in A", checkSupplyA({eq: initAmountA.add(depositAmount)}));
    });

    describe("Deposit when all floors are filled, only ceiling B is filled and deposit size doesn't cross ceiling C", () => {
        const initAmountA = ethers.utils.parseEther("140");
        const initAmountB = ethers.utils.parseEther("2000");
        const initAmountC = ethers.utils.parseEther("380");
        const depositAmount = ethers.utils.parseEther("50");

        before(deployAndInitContracts);
        before(bootstrapAdaptors({initAmountA, initAmountB, initAmountC}));

        it("Supply of A should be between floor and ceiling", checkSupplyA({gt: FLOOR, lt: CEILING}));
        it("Supply of B should be equal to ceiling", checkSupplyB({eq: CEILING}));
        it("Supply of C should be between floor and ceiling", checkSupplyC({gt: FLOOR, lt: CEILING}));
        it("Deposit size should not exceed C ceiling", async () => {
            const supply = await cAdaptor.getSupplyView(dai.address);
            const ceiling = await cAdaptor.ceilingMap(dai.address);
            supply.add(depositAmount).should.be.lte(ceiling);
        });

        it("Deposit DAI", depositDAI({amount: depositAmount}));

        it("Amount should be deposited in C", checkSupplyC({eq: initAmountC.add(depositAmount)}));
    });

    /**
     * deposit 1 -> 140 to A
     * deposit 2 -> 260 to B
     * deposit 3 -> 380 to C
     *
     * withdrawSequence - B > C > A
     *
     * withdraw 1 -> 150 -> 150 from B (110 left)
     * withdraw 2 -> 200 -> 110 from B (000 left) and 90 from C (290 left)
     * withdraw 3 -> 130 -> 130 from C (160 left)
     * withdraw 4 -> 180 -> 160 from C (000 left) and 20 from A (120 left)
     * withdraw 5 -> 120 -> 120 from A (000 left)
     */
    describe("Check wihdraw sequence", () => {
        const depositAmount1 = ethers.utils.parseEther("140");
        const depositAmount2 = ethers.utils.parseEther("260");
        const depositAmount3 = ethers.utils.parseEther("380");

        const withdrawAmount1 = ethers.utils.parseEther("150");
        const withdrawAmount2 = ethers.utils.parseEther("200");
        const withdrawAmount3 = ethers.utils.parseEther("130");
        const withdrawAmount4 = ethers.utils.parseEther("180");
        const withdrawAmount5 = ethers.utils.parseEther("120");

        before(deployAndInitContracts);
        before(async () => {
            await assetManager.changeWithdrawSequence([1, 2, 0]); // B > C > A
            await dai.approve(assetManager.address, depositAmount1.add(depositAmount2).add(depositAmount3));
            await assetManager.deposit(dai.address, depositAmount1);
            await assetManager.deposit(dai.address, depositAmount2);
            await assetManager.deposit(dai.address, depositAmount3);
        });

        it("A should have correct amount", checkSupplyA({eq: depositAmount1}));
        it("B should have correct amount", checkSupplyB({eq: depositAmount2}));
        it("C should have correct amount", checkSupplyC({eq: depositAmount3}));

        it("Withdraw amount covered by B", withdrawDAI({amount: withdrawAmount1}));
        it("B should have correct amount", checkSupplyB({eq: ethers.utils.parseEther("110")}));

        it("Withdraw amount covered by B and C", withdrawDAI({amount: withdrawAmount2}));
        it("B should have correct amount", checkSupplyB({eq: ethers.utils.parseEther("0")}));
        it("C should have correct amount", checkSupplyC({eq: ethers.utils.parseEther("290")}));

        it("Withdraw amount covered by C", withdrawDAI({amount: withdrawAmount3}));
        it("C should have correct amount", checkSupplyC({eq: ethers.utils.parseEther("160")}));

        it("Withdraw amount covered by C and A", withdrawDAI({amount: withdrawAmount4}));
        it("C should have correct amount", checkSupplyC({eq: ethers.utils.parseEther("0")}));
        it("A should have correct amount", checkSupplyA({eq: ethers.utils.parseEther("120")}));

        it("Withdraw amount covered by A", withdrawDAI({amount: withdrawAmount5}));
        it("A should have correct amount", checkSupplyA({eq: ethers.utils.parseEther("0")}));
    });
});
