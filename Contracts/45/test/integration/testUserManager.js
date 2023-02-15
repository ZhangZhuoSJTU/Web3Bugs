const {ethers, upgrades, waffle} = require("hardhat");
const {parseEther} = ethers.utils;
const {waitNBlocks} = require("../../utils");

require("chai").should();

describe("UserManager Contract", async () => {
    before(async () => {
        [ADMIN, STAKER_A, STAKER_B, STAKER_C, STAKER_D, STAKER_E, BORROWER_Z, BORROWER_Y, proxyAdmin] =
            await ethers.getSigners();

        console.log("Creating proxy instance of ERC20...");
        erc20Proxy = await upgrades.deployProxy(
            await ethers.getContractFactory("FaucetERC20"),
            ["Dai Stablecoin", "DAI"], //Must be "Dai Stablecoin" or permit signature verification will fail
            {initializer: "__FaucetERC20_init(string,string)"}
        );
        console.log(`ERC20 proxy created at ${erc20Proxy.address}`);

        console.log("Creating proxy instance of SumOfTrust.sol...");
        const SumOfTrust = await ethers.getContractFactory("SumOfTrust");
        sumOfTrust = await SumOfTrust.deploy(3);
        console.log(`SumOfTrust proxy created at ${sumOfTrust.address}`);

        console.log("Creating proxy instance of FixedInterestRateModel.sol...");
        //The interest rate is set to 0 to prevent interference
        const FixedInterestRateModel = await ethers.getContractFactory("FixedInterestRateModel");
        fixedInterestRateModel = await FixedInterestRateModel.deploy(ethers.utils.parseEther("0"));
        console.log(`FixedInterestRateModel proxy created at ${fixedInterestRateModel.address}`);

        console.log("Creating proxy instance of CreditLimitByMedian.sol...");
        const CreditLimitByMedian = await ethers.getContractFactory("CreditLimitByMedian");
        creditLimitByMedian = await CreditLimitByMedian.deploy(3);
        console.log(`CreditLimitByMedian proxy created at ${creditLimitByMedian.address}`);

        console.log("Creating proxy instance of unionToken.sol...");
        const block = await waffle.provider.getBlock("latest");
        const time = block.timestamp;
        const UnionToken = await ethers.getContractFactory("UnionToken");
        unionTokenProxy = await UnionToken.deploy("Union Token", "UNION", parseInt(time) + 10);
        console.log(`UnionToken proxy created at ${unionTokenProxy.address}`);
    });

    describe("testDebtWriteOff", () => {
        before(async () => {
            const amount = parseEther("10000");
            await erc20Proxy.mint(ADMIN.address, parseEther("10000000"));
            await erc20Proxy.transfer(STAKER_A.address, amount);
            await erc20Proxy.transfer(STAKER_B.address, amount);
            await erc20Proxy.transfer(STAKER_C.address, amount);
            await erc20Proxy.transfer(STAKER_D.address, amount);
            await erc20Proxy.transfer(STAKER_E.address, amount);

            console.log("Creating proxy instance of MarketRegistry.sol...");
            marketRegistryProxy = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), {
                initializer: "__MarketRegistry_init()"
            });
            console.log(`MarketRegistry proxy created at ${marketRegistryProxy.address}`);

            console.log("Creating proxy instance of Comptroller.sol...");
            comptroller = await upgrades.deployProxy(
                await ethers.getContractFactory("Comptroller"),
                [unionTokenProxy.address, marketRegistryProxy.address],
                {initializer: "__Comptroller_init(address,address)"}
            );
            console.log(`Comptroller proxy created at ${comptroller.address}`);

            console.log("Creating proxy instance of AssetManager.sol...");
            assetManagerProxy = await upgrades.deployProxy(
                await ethers.getContractFactory("AssetManager"),
                [marketRegistryProxy.address],
                {
                    initializer: "__AssetManager_init(address)"
                }
            );
            console.log(`AssetManager proxy created at ${assetManagerProxy.address}`);

            console.log("Creating proxy instance of userManagerProxy.sol...");
            userManagerProxy = await upgrades.deployProxy(
                await ethers.getContractFactory("UserManager"),
                [
                    assetManagerProxy.address,
                    unionTokenProxy.address,
                    erc20Proxy.address,
                    sumOfTrust.address,
                    comptroller.address,
                    ADMIN.address
                ],
                {
                    initializer: "__UserManager_init(address,address,address,address,address,address)"
                }
            );
            console.log(`UserManager proxy created at ${userManagerProxy.address}`);
            //Handling fee is set to 0
            await userManagerProxy.setNewMemberFee(0);

            const UErc20 = await ethers.getContractFactory("UErc20");
            const uErc20 = await UErc20.deploy("UToken", "UToken");
            uTokenProxy = await upgrades.deployProxy(
                await ethers.getContractFactory("UToken"),
                [
                    uErc20.address,
                    erc20Proxy.address,
                    "1000000000000000000",
                    "500000000000000000",
                    "0",
                    "1000000000000000000000000",
                    "10000000000000000000000",
                    "1000000000000000000",
                    "10",
                    ADMIN.address
                ],
                {
                    initializer:
                        "__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"
                }
            );
            await uErc20.transferOwnership(uTokenProxy.address);
            await uTokenProxy.setInterestRateModel(fixedInterestRateModel.address);
            await uTokenProxy.setAssetManager(assetManagerProxy.address);
            await uTokenProxy.setUserManager(userManagerProxy.address);
            await userManagerProxy.setUToken(uTokenProxy.address);
            await marketRegistryProxy.addUToken(erc20Proxy.address, uTokenProxy.address);
            await marketRegistryProxy.addUserManager(erc20Proxy.address, userManagerProxy.address);

            await erc20Proxy.approve(uTokenProxy.address, parseEther("10000"));
            await uTokenProxy.mint(parseEther("10000"));

            await erc20Proxy.connect(STAKER_A).approve(userManagerProxy.address, amount);
            await erc20Proxy.connect(STAKER_B).approve(userManagerProxy.address, amount);
            await erc20Proxy.connect(STAKER_C).approve(userManagerProxy.address, amount);

            await userManagerProxy.addMember(STAKER_A.address);
            await userManagerProxy.addMember(STAKER_B.address);
            await userManagerProxy.addMember(STAKER_C.address);
            await userManagerProxy.addMember(BORROWER_Z.address);

            await userManagerProxy.connect(STAKER_A).stake(parseEther("100"));
            await userManagerProxy.connect(STAKER_B).stake(parseEther("60"));
            await userManagerProxy.connect(STAKER_C).stake(parseEther("25"));
        });

        it("debtWriteOff", async () => {
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("100"));
            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("60"));
            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("25"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq(parseEther("185").toString());
            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("185"));
            await waitNBlocks(11);
            const isOverdue = await uTokenProxy.checkIsOverdue(BORROWER_Z.address);
            isOverdue.should.eq(true);

            staker_b_locked_stake = await userManagerProxy.getLockedStake(STAKER_B.address, BORROWER_Z.address);
            staker_b_locked_stake.toString().should.eq(parseEther("60").toString());
            borrowed = await uTokenProxy.borrowBalanceView(BORROWER_Z.address);
            borrowed.toString().should.eq(parseEther("185").toString());
            stake_b_amount = await userManagerProxy.stakers(STAKER_B.address);
            stake_b_amount.toString().should.eq(parseEther("60").toString());

            await userManagerProxy.connect(STAKER_B).debtWriteOff(BORROWER_Z.address, parseEther("50"));

            staker_b_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_B.address);
            staker_b_locked_stake.toString().should.eq(parseEther("10").toString()); //60-50
            borrowed = await uTokenProxy.borrowBalanceView(BORROWER_Z.address);
            borrowed.toString().should.eq(parseEther("135").toString()); //185-50
            stake_b_amount = await userManagerProxy.stakers(STAKER_B.address);
            stake_b_amount.toString().should.eq(parseEther("10").toString()); //60-50
        });
    });

    describe("testLockedStakedBySumOfTrust", () => {
        before(async () => {
            const amount = parseEther("10000");
            await erc20Proxy.mint(ADMIN.address, parseEther("10000000"));
            await erc20Proxy.transfer(STAKER_A.address, amount);
            await erc20Proxy.transfer(STAKER_B.address, amount);
            await erc20Proxy.transfer(STAKER_C.address, amount);
            await erc20Proxy.transfer(STAKER_D.address, amount);
            await erc20Proxy.transfer(STAKER_E.address, amount);
        });

        beforeEach(async () => {
            try {
                const amount = parseEther("10000");

                console.log("Creating proxy instance of MarketRegistry.sol...");
                marketRegistryProxy = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), {
                    initializer: "__MarketRegistry_init()"
                });
                console.log(`MarketRegistry proxy created at ${marketRegistryProxy.address}`);

                console.log("Creating proxy instance of Comptroller.sol...");
                comptroller = await upgrades.deployProxy(
                    await ethers.getContractFactory("Comptroller"),
                    [unionTokenProxy.address, marketRegistryProxy.address],
                    {initializer: "__Comptroller_init(address,address)"}
                );
                console.log(`Comptroller proxy created at ${comptroller.address}`);
                await unionTokenProxy.transfer(comptroller.address, amount);

                console.log("Creating proxy instance of AssetManager.sol...");
                assetManagerProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("AssetManager"),
                    [marketRegistryProxy.address],
                    {
                        initializer: "__AssetManager_init(address)"
                    }
                );
                console.log(`AssetManager proxy created at ${assetManagerProxy.address}`);

                console.log("Creating proxy instance of userManagerProxy.sol...");
                userManagerProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("UserManager"),
                    [
                        assetManagerProxy.address,
                        unionTokenProxy.address,
                        erc20Proxy.address,
                        sumOfTrust.address,
                        comptroller.address,
                        ADMIN.address
                    ],
                    {
                        initializer: "__UserManager_init(address,address,address,address,address,address)"
                    }
                );
                console.log(`UserManager proxy created at ${userManagerProxy.address}`);
                //Handling fee is set to 0
                await userManagerProxy.setNewMemberFee(0);

                const UErc20 = await ethers.getContractFactory("UErc20");
                const uErc20 = await UErc20.deploy("UToken", "UToken");
                uTokenProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("UToken"),
                    [
                        uErc20.address,
                        erc20Proxy.address,
                        "1000000000000000000",
                        "500000000000000000",
                        "0",
                        "1000000000000000000000000",
                        "10000000000000000000000",
                        "1000000000000000000",
                        "10",
                        ADMIN.address
                    ],
                    {
                        initializer:
                            "__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"
                    }
                );
                await uErc20.transferOwnership(uTokenProxy.address);

                await uTokenProxy.setInterestRateModel(fixedInterestRateModel.address);
                await uTokenProxy.setAssetManager(assetManagerProxy.address);
                await uTokenProxy.setUserManager(userManagerProxy.address);

                await userManagerProxy.setUToken(uTokenProxy.address);

                await marketRegistryProxy.addUToken(erc20Proxy.address, uTokenProxy.address);
                await marketRegistryProxy.addUserManager(erc20Proxy.address, userManagerProxy.address);
                await erc20Proxy.approve(uTokenProxy.address, parseEther("10000"));
                await uTokenProxy.mint(parseEther("10000"));

                await erc20Proxy.connect(STAKER_A).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_B).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_C).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_D).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_E).approve(userManagerProxy.address, amount);

                await userManagerProxy.addMember(STAKER_A.address);
                await userManagerProxy.addMember(STAKER_B.address);
                await userManagerProxy.addMember(STAKER_C.address);
                await userManagerProxy.addMember(STAKER_D.address);
                await userManagerProxy.addMember(STAKER_E.address);
                await userManagerProxy.addMember(BORROWER_Z.address);
                await userManagerProxy.addMember(BORROWER_Y.address);
            } catch (error) {
                console.error("ERROR deploying contracts: ", error);
            }
        });

        //When staker A is the person with the largest amount of trust borrower z and part of the amount has been locked due to borrow y, when borrower z lends the maximum amount, are the locked amounts of staker b and staker c correct
        /*
         * staker A stake 20, trust borrower z 20, locked 10 by borrower y
         * staker B stake 10, trust borrower z 10, locked 0
         * staker C stake 5, trust borrower z 5, locked 0
         * borrower z borrow 25
         */
        it("locked stake", async () => {
            let staker_a_locked_stake, staker_b_locked_stake, staker_c_locked_stake;
            let borrower_z_credit_limit;

            await userManagerProxy.connect(STAKER_A).stake(parseEther("20"));
            await userManagerProxy.connect(STAKER_B).stake(parseEther("10"));
            await userManagerProxy.connect(STAKER_C).stake(parseEther("5"));
            await userManagerProxy.connect(STAKER_D).stake(parseEther("10"));
            await userManagerProxy.connect(STAKER_E).stake(parseEther("10"));

            //Staker A,D,E trust borrower y 10, and y borrow 30
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Y.address, parseEther("10"));
            await userManagerProxy.connect(STAKER_D).updateTrust(BORROWER_Y.address, parseEther("10"));
            await userManagerProxy.connect(STAKER_E).updateTrust(BORROWER_Y.address, parseEther("10"));
            await uTokenProxy.connect(BORROWER_Y).borrow(parseEther("30"));

            //A's total locked stake is 10
            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq(parseEther("10").toString());

            //Staker A,B,C trust borrower z, and z borrow 25
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("20"));
            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("10"));
            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("5"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq(parseEther("25").toString()); //(20-10)+10+5=25
            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("25"));

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("20").toString());
            let staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_A.address,
                BORROWER_Z.address
            );

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("10").toString());
            let staker_a_locked_stake_for_y = await userManagerProxy.getLockedStake(
                STAKER_A.address,
                BORROWER_Y.address
            );

            staker_a_locked_stake_for_y.toString().should.eq(parseEther("10").toString());

            staker_b_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_B.address);

            staker_b_locked_stake.toString().should.eq(parseEther("10").toString());
            let staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_B.address,
                BORROWER_Z.address
            );

            staker_b_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_c_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_C.address);

            staker_c_locked_stake.toString().should.eq(parseEther("5").toString());
            let staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_C.address,
                BORROWER_Z.address
            );

            staker_c_locked_stake_for_z.toString().should.eq(parseEther("5").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq("0");
        });

        /*
         * staker A stake 10, trust borrower z 10, locked 2 by borrower y
         * staker B stake 10, trust borrower z 10, locked 0
         * staker C stake 10, trust borrower z 10, locked 0
         * borrower z borrow 2
         */
        it("locked stake2", async () => {
            let staker_a_locked_stake, staker_b_locked_stake, staker_c_locked_stake;
            let borrower_z_credit_limit;

            await userManagerProxy.connect(STAKER_A).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_B).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_C).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_D).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_E).stake(parseEther("10"));

            //Staker A,D,E trust borrower y 2, and y borrow 6
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Y.address, parseEther("2"));

            await userManagerProxy.connect(STAKER_D).updateTrust(BORROWER_Y.address, parseEther("2"));

            await userManagerProxy.connect(STAKER_E).updateTrust(BORROWER_Y.address, parseEther("2"));

            await uTokenProxy.connect(BORROWER_Y).borrow(parseEther("6"));

            //A's total locked stake is 2
            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("2").toString());

            //Staker A,B,C trust borrower z, and z borrow 2
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("10"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("28").toString()); //(10-2)+10+10=28

            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("2"));
            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("4").toString());
            let staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_A.address,
                BORROWER_Z.address
            );

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("2").toString());

            staker_b_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_B.address);

            staker_b_locked_stake.toString().should.eq(parseEther("0").toString());
            let staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_B.address,
                BORROWER_Z.address
            );

            staker_b_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            staker_c_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_C.address);

            staker_c_locked_stake.toString().should.eq(parseEther("0").toString());
            let staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_C.address,
                BORROWER_Z.address
            );

            staker_c_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("26").toString()); //28-2

            await erc20Proxy.connect(BORROWER_Z).approve(uTokenProxy.address, parseEther("2"));

            await uTokenProxy.connect(BORROWER_Z).repayBorrow(parseEther("2"));

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("2").toString());
            staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_A.address, BORROWER_Z.address);

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("28").toString());
        });

        /*
         * staker A stake 10, trust borrower z 10
         * staker B stake 10, trust borrower z 10
         * staker C stake 10, trust borrower z 10
         * borrower z borrow 30 interest >0
         */
        it("locked stake3", async () => {
            let staker_a_locked_stake, staker_b_locked_stake, staker_c_locked_stake;
            let borrower_z_credit_limit;

            await userManagerProxy.connect(STAKER_A).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_B).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_C).stake(parseEther("10"));

            //Staker A,B,C trust borrower z, and z borrow 30
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("10"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("30").toString());

            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("30"));
            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("10").toString());
            let staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_A.address,
                BORROWER_Z.address
            );

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_b_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_B.address);

            staker_b_locked_stake.toString().should.eq(parseEther("10").toString());
            let staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_B.address,
                BORROWER_Z.address
            );

            staker_b_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_c_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_C.address);

            staker_c_locked_stake.toString().should.eq(parseEther("10").toString());
            let staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(
                STAKER_C.address,
                BORROWER_Z.address
            );

            staker_c_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("0").toString());

            await fixedInterestRateModel.setInterestRate(parseEther("0.000001"));

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);

            staker_a_locked_stake.toString().should.eq(parseEther("10").toString());
            staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_A.address, BORROWER_Z.address);

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_b_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_B.address);

            staker_b_locked_stake.toString().should.eq(parseEther("10").toString());
            staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_B.address, BORROWER_Z.address);

            staker_b_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_c_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_C.address);

            staker_c_locked_stake.toString().should.eq(parseEther("10").toString());
            staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_C.address, BORROWER_Z.address);

            staker_c_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            //past 1 block interest = 30*0.1 = 3 credit limit = 0-3 = -3
            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("-0.00003").toString());

            await userManagerProxy.connect(STAKER_A).stake(parseEther("15"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("-0.00006").toString());

            await fixedInterestRateModel.setInterestRate(parseEther("0"));
        });

        /*
         * staker A stake 10, trust borrower z 10
         * staker B stake 10, trust borrower z 10
         * staker C stake 1, trust borrower z 10
         * borrower z borrow 1 fee 0.1%
         */
        it("locked stake4", async () => {
            let staker_a_locked_stake_for_z, staker_b_locked_stake_for_z, staker_c_locked_stake_for_z;
            let borrower_z_credit_limit;

            await uTokenProxy.setOriginationFee(parseEther("0.01"));

            await userManagerProxy.connect(STAKER_A).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_B).stake(parseEther("10"));

            await userManagerProxy.connect(STAKER_C).stake(parseEther("1"));

            //Staker A,B,C trust borrower z, and z borrow 10
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("10"));

            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("10"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);

            borrower_z_credit_limit.toString().should.eq(parseEther("21").toString());

            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("10"));
            staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_A.address, BORROWER_Z.address);

            staker_a_locked_stake_for_z.toString().should.eq(parseEther("10").toString());

            staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_B.address, BORROWER_Z.address);
            staker_b_locked_stake_for_z.toString().should.eq(parseEther("0.1").toString());

            staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_C.address, BORROWER_Z.address);
            staker_c_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq(parseEther("10.9").toString());

            await erc20Proxy.connect(BORROWER_Z).approve(uTokenProxy.address, parseEther("10.1"));
            await uTokenProxy.connect(BORROWER_Z).repayBorrow(parseEther("10.1"));

            staker_a_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_A.address, BORROWER_Z.address);
            staker_a_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            staker_b_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_B.address, BORROWER_Z.address);
            staker_b_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            staker_c_locked_stake_for_z = await userManagerProxy.getLockedStake(STAKER_C.address, BORROWER_Z.address);
            staker_c_locked_stake_for_z.toString().should.eq(parseEther("0").toString());

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq(parseEther("21").toString());

            await uTokenProxy.setOriginationFee(parseEther("0"));
        });
    });

    describe("testVouchAmounts", () => {
        before(async () => {
            try {
                const amount = parseEther("10000");
                await erc20Proxy.mint(ADMIN.address, parseEther("10000000"));
                await erc20Proxy.transfer(STAKER_A.address, amount);
                await erc20Proxy.transfer(STAKER_B.address, amount);
                await erc20Proxy.transfer(STAKER_C.address, amount);
                await erc20Proxy.transfer(STAKER_D.address, amount);
                await erc20Proxy.transfer(STAKER_E.address, amount);

                console.log("Creating proxy instance of MarketRegistry.sol...");
                marketRegistryProxy = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), {
                    initializer: "__MarketRegistry_init()"
                });
                console.log(`MarketRegistry proxy created at ${marketRegistryProxy.address}`);

                console.log("Creating proxy instance of Comptroller.sol...");
                comptroller = await upgrades.deployProxy(
                    await ethers.getContractFactory("Comptroller"),
                    [unionTokenProxy.address, marketRegistryProxy.address],
                    {initializer: "__Comptroller_init(address,address)"}
                );
                console.log(`Comptroller proxy created at ${comptroller.address}`);
                await unionTokenProxy.transfer(comptroller.address, amount);

                console.log("Creating proxy instance of AssetManager.sol...");
                assetManagerProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("AssetManager"),
                    [marketRegistryProxy.address],
                    {
                        initializer: "__AssetManager_init(address)"
                    }
                );
                console.log(`AssetManager proxy created at ${assetManagerProxy.address}`);

                console.log("Creating proxy instance of userManagerProxy.sol...");
                userManagerProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("UserManager"),
                    [
                        assetManagerProxy.address,
                        unionTokenProxy.address,
                        erc20Proxy.address,
                        creditLimitByMedian.address,
                        comptroller.address,
                        ADMIN.address
                    ],
                    {
                        initializer: "__UserManager_init(address,address,address,address,address,address)"
                    }
                );
                console.log(`UserManager proxy created at ${userManagerProxy.address}`);
                //Handling fee is set to 0
                await userManagerProxy.setNewMemberFee(0);

                const UErc20 = await ethers.getContractFactory("UErc20");
                const uErc20 = await UErc20.deploy("UToken", "UToken");
                uTokenProxy = await upgrades.deployProxy(
                    await ethers.getContractFactory("UToken"),
                    [
                        uErc20.address,
                        erc20Proxy.address,
                        "1000000000000000000",
                        "500000000000000000",
                        "0",
                        "1000000000000000000000000",
                        "10000000000000000000000",
                        "1000000000000000000",
                        "10",
                        ADMIN.address
                    ],
                    {
                        initializer:
                            "__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"
                    }
                );
                await uErc20.transferOwnership(uTokenProxy.address);

                await uTokenProxy.setInterestRateModel(fixedInterestRateModel.address);
                await uTokenProxy.setAssetManager(assetManagerProxy.address);
                await uTokenProxy.setUserManager(userManagerProxy.address);
                await userManagerProxy.setUToken(uTokenProxy.address);
                await marketRegistryProxy.addUToken(erc20Proxy.address, uTokenProxy.address);
                await marketRegistryProxy.addUserManager(erc20Proxy.address, userManagerProxy.address);

                await erc20Proxy.approve(uTokenProxy.address, parseEther("10000"));
                await uTokenProxy.mint(parseEther("10000"));

                await erc20Proxy.connect(STAKER_A).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_B).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_C).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_D).approve(userManagerProxy.address, amount);
                await erc20Proxy.connect(STAKER_E).approve(userManagerProxy.address, amount);
            } catch (error) {
                console.error("ERROR deploying contracts: ", error);
            }
        });

        it("User vouch amounts", async () => {
            //A deposits 100 dai
            await userManagerProxy.connect(STAKER_A).stake(parseEther("100"));
            await userManagerProxy.connect(STAKER_B).stake(parseEther("60"));
            await userManagerProxy.connect(STAKER_C).stake(parseEther("25"));
            await userManagerProxy.connect(STAKER_D).stake(parseEther("100"));
            await userManagerProxy.connect(STAKER_E).stake(parseEther("125"));

            let staker_a_stake, staker_a_locked_stake, staker_a_defaulted_stake;
            let borrower_z_credit_limit, borrower_y_credit_limit;

            //A's withdrawable stake is 100, Utilized stake is 0, defaulted stake is 0
            staker_a_stake = await userManagerProxy.getStakerBalance(STAKER_A.address);
            staker_a_stake.toString().should.eq(parseEther("100").toString());

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq("0");

            staker_a_defaulted_stake = await userManagerProxy.getTotalFrozenAmount(STAKER_A.address);
            staker_a_defaulted_stake.toString().should.eq("0");

            await userManagerProxy.addMember(STAKER_A.address);
            await userManagerProxy.addMember(STAKER_B.address);
            await userManagerProxy.addMember(STAKER_C.address);
            await userManagerProxy.addMember(STAKER_D.address);
            await userManagerProxy.addMember(STAKER_E.address);

            //A, B, C set trust for Z(100,60,25) and the "vouch" is the same.
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("100"));
            await userManagerProxy.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("60"));
            await userManagerProxy.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("25"));
            await unionTokenProxy.transfer(BORROWER_Z.address, parseEther("1"));
            await unionTokenProxy.connect(BORROWER_Z).approve(userManagerProxy.address, parseEther("1"));
            await userManagerProxy.connect(BORROWER_Z).registerMember(BORROWER_Z.address);

            //A, D, E set trust for Y(60, 100, 125) and the "vouch" is the same.
            await userManagerProxy.connect(STAKER_A).updateTrust(BORROWER_Y.address, parseEther("60"));
            await userManagerProxy.connect(STAKER_D).updateTrust(BORROWER_Y.address, parseEther("100"));
            await userManagerProxy.connect(STAKER_E).updateTrust(BORROWER_Y.address, parseEther("125"));
            await unionTokenProxy.transfer(BORROWER_Y.address, parseEther("1"));
            await unionTokenProxy.connect(BORROWER_Y).approve(userManagerProxy.address, parseEther("1"));
            await userManagerProxy.connect(BORROWER_Y).registerMember(BORROWER_Y.address);

            //A's [F/U/D] stake states remains 100, 0, 0
            staker_a_stake = await userManagerProxy.getStakerBalance(STAKER_A.address);
            staker_a_stake.toString().should.eq(parseEther("100").toString());

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq("0");

            staker_a_defaulted_stake = await userManagerProxy.getTotalFrozenAmount(STAKER_A.address);
            staker_a_defaulted_stake.toString().should.eq("0");

            //Z(100,60,25) has a credit limit of median(60) or SumTrust(185)
            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq(parseEther("60").toString());

            //Y(60, 100, 125) has a credit limit of median(100) or SumTrust(285)
            borrower_y_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Y.address);
            borrower_y_credit_limit.toString().should.eq(parseEther("100").toString());

            //Z Borrows 60 which locks up to 60 from their vouchers stake [A(60), B(60),C(25)]
            await uTokenProxy.connect(BORROWER_Z).borrow(parseEther("60"));

            borrower_z_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Z.address);
            borrower_z_credit_limit.toString().should.eq("0");

            //A's stake states change to With-drawable = 40, Utilized = 60, Defaulted = 0
            staker_a_stake = await userManagerProxy.getStakerBalance(STAKER_A.address);
            staker_a_stake.toString().should.eq(parseEther("100").toString());

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq(parseEther("60").toString());

            staker_a_defaulted_stake = await userManagerProxy.getTotalFrozenAmount(STAKER_A.address);
            staker_a_defaulted_stake.toString().should.eq("0");

            //Y now has the updated vouch of (40, 100, 125) giving Y a credit limit of 100(median) & 265(sumtrust) respectively
            //But A, D, E haven't changed the trust settings for Y. Only the vouch calculated on the fly has
            borrower_y_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Y.address);
            borrower_y_credit_limit.toString().should.eq(parseEther("100").toString());

            //If Y borrows 100 which would lock up to 100 from A, D, E => (60,100,100)
            await uTokenProxy.connect(BORROWER_Y).borrow(parseEther("100"));

            //A, D, E free stake would end up as (0,0,25) which => median(0) & sumtrust(25)
            borrower_y_credit_limit = await userManagerProxy.getCreditLimit(BORROWER_Y.address);
            borrower_y_credit_limit.toString().should.eq("0");

            //A would end up with the stake states of 0 with-drawable, 100 utilized, 0 defaulted
            staker_a_stake = await userManagerProxy.getStakerBalance(STAKER_A.address);
            staker_a_stake.toString().should.eq(parseEther("100").toString());

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq(parseEther("100").toString());

            staker_a_defaulted_stake = await userManagerProxy.getTotalFrozenAmount(STAKER_A.address);
            staker_a_defaulted_stake.toString().should.eq("0");

            //Now if Z pays back the 60
            await erc20Proxy.connect(BORROWER_Z).approve(uTokenProxy.address, parseEther("60"));
            await uTokenProxy.connect(BORROWER_Z).repayBorrow(parseEther("60"));

            //That means A would end up with stake states of 60 with-drawable, 40 utilized, 0 defaulted.
            staker_a_stake = await userManagerProxy.getStakerBalance(STAKER_A.address);
            staker_a_stake.toString().should.eq(parseEther("100").toString());

            staker_a_locked_stake = await userManagerProxy.getTotalLockedStake(STAKER_A.address);
            staker_a_locked_stake.toString().should.eq(parseEther("40").toString());

            staker_a_defaulted_stake = await userManagerProxy.getTotalFrozenAmount(STAKER_A.address);
            staker_a_defaulted_stake.toString().should.eq("0");
        });
    });
});
