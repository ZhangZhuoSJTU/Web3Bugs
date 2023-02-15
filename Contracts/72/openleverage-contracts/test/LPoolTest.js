const utils = require("./utils/OpenLevUtil");
const {toWei, assertPrint, assertThrows} = require("./utils/OpenLevUtil");

const {toBN, maxUint, advanceMultipleBlocks} = require("./utils/EtheUtil");
const m = require('mocha-logger');
const timeMachine = require('ganache-time-traveler');
const LPool = artifacts.require('LPool');
const LPoolDelegator = artifacts.require('LPoolDelegator');
const LPoolDepositor = artifacts.require('LPoolDepositor');

contract("LPoolDelegator", async accounts => {

    // roles
    let admin = accounts[0];
    let borrower0 = accounts[1];
    let borrower1 = accounts[2];
    let lender0 = accounts[3];
    let lender1 = accounts[4];

    before(async () => {
        // runs once before the first test in this block
    });

    it("Supply,borrow,repay,redeem test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let blocksPerYear = toBN(2102400);
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        let cash = await erc20Pool.getCash();
        assert.equal(cash, 0);
        /**
         * deposit
         */
        //deposit10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(10000 * 1e10);
        await erc20Pool.setReserveFactor(toBN(2e17));
        //Checking deposits
        assert.equal(await erc20Pool.getCash(), 10000 * 1e10);
        assert.equal(await erc20Pool.totalSupply(), 10000 * 1e10);
        //Check deposit rate
        assert.equal(await erc20Pool.supplyRatePerBlock(), 0);
        //Check loan interest rate
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        /**
         * borrow money
         */
        //borrow money5000
        await erc20Pool.borrowBehalf(accounts[0], 5000 * 1e10);
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '99999999996537600');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '39999999997353600');
        //inspect snapshot
        let accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 10000 * 1e10);
        assert.equal(accountSnapshot[1], 5000 * 1e10);
        assert.equal(accountSnapshot[2], 1e18);
        //Borrow 2000 more
        await erc20Pool.borrowBehalf(accounts[0], 2000 * 1e10);
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '140000002087881600');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '78400002340166400');
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[1], 70000002378234);
        assert.equal(accountSnapshot[2].toString(), 1000000019025880000);
        //Total borrowings
        assert.equal(await erc20Pool.totalBorrows(), 70000002378234);
        //Update total borrowings and interest
        await erc20Pool.accrueInterest();
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '140000006189664000');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '78400006933910400');
        //rate of exchange
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), '1000000056316600000');
        // assert.equal((await erc20Pool.borrowBalanceCurrent(accounts[0])).toString(), '70000007039573');
        /**
         * repayment
         */
        await erc20Pool.repayBorrowBehalf(accounts[0], maxUint());
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 10000 * 1e10);
        assert.equal(accountSnapshot[1], 0);
        //Total borrowings
        assert.equal(await erc20Pool.totalBorrows(), 0);
        //Total deposit
        assert.equal(await erc20Pool.totalSupply(), 10000 * 1e10);
        //Loan interest rate and deposit interest rate
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '0');
        //rate of exchange
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), '1000000093607320000');
        /**
         * Withdrawal
         */
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 0);
        assert.equal((await testToken.balanceOf(accounts[0])).toString(), "9999999999999997659819");
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '0');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), 1e18);
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '0');

    })

    it("borrowTo test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        // deposit 10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(10000 * 1e10);
        //Borrow money 5000
        await erc20Pool.borrowBehalf(accounts[0], 5000 * 1e10, {from: accounts[1]});
        assert.equal((await testToken.balanceOf(accounts[1])).toString(), toBN(5000).mul(toBN(1e10)).toString());
        // inspect snapshot
        let accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 10000 * 1e10);
        assert.equal(accountSnapshot[1], 5000 * 1e10);
        assert.equal(accountSnapshot[2], 1e18);

    })

    it("repayBorrowEndByOpenLev test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        await erc20Pool.setReserveFactor(toBN(2e17));
        // deposit 10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(10000 * 1e10);
        //Borrow money 5000
        await erc20Pool.borrowBehalf(accounts[2], 5000 * 1e10, {from: accounts[1]});
        // advance 1000 blocks
        await advanceMultipleBlocks(1000);
        m.log("advance 1000 blocks...");
        let exchangeRateStored1 = await erc20Pool.exchangeRateStored();
        m.log("exchangeRateStored1", exchangeRateStored1);
        assert.equal('1000000000000000000', exchangeRateStored1);

        await testToken.approve(erc20Pool.address, maxUint(), {from: accounts[1]});
        await controller.setOpenLev(accounts[1]);
        let tx = await erc20Pool.repayBorrowEndByOpenLev(accounts[2], 1000 * 1e10, {from: accounts[1]});
        m.log("tx", JSON.stringify(tx));
        assertPrint("repayAmount", '10000000000000', toBN(tx.logs[3].args.repayAmount));
        assertPrint("badDebtsAmount", '40002385369101', toBN(tx.logs[3].args.badDebtsAmount));
        assertPrint("accountBorrowsNew", '0', toBN(tx.logs[3].args.accountBorrows));
        assertPrint("totalBorrows", '0', toBN(tx.logs[3].args.totalBorrows));

        let borrowsCurrent = await erc20Pool.borrowBalanceCurrent(accounts[1]);
        assert.equal(0, borrowsCurrent);
        let totalBorrowCurrent = await erc20Pool.totalBorrowsCurrent();
        assert.equal(0, totalBorrowCurrent);
        let exchangeRateStored2 = await erc20Pool.exchangeRateStored();
        let getCash2 = await erc20Pool.getCash();
        m.log("exchangeRateStored2", exchangeRateStored2);
        m.log("getCash2", getCash2);
        assert.equal('599995229261800000', exchangeRateStored2.toString());
        assert.equal('60000000000000', getCash2);
        await erc20Pool.mint(1000 * 1e10);
        //
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        //
        let getCash3 = await erc20Pool.getCash();
        let totalReserves = await erc20Pool.totalReserves();
        //
        assert.equal('477073821', getCash3);
        assert.equal('477073820', totalReserves);
        let exchangeRateStored3 = await erc20Pool.exchangeRateStored();
        m.log("exchangeRateStored3", exchangeRateStored3);
        assert.equal('1000000000000000000', exchangeRateStored3);
    })

    it("borrow out of range test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let testToken = createPoolResult.token;
        let erc20Pool = createPoolResult.pool;
        await utils.mint(testToken, admin, 10000);
        //deposit 10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(10000 * 1e10);
        let maxBorrow = await erc20Pool.availableForBorrow();
        m.log('maxBorrow', maxBorrow.toString());
        //Maximum borrowing amount + 1
        await assertThrows(erc20Pool.borrowBehalf(accounts[0], maxBorrow.add(toBN('1'))), 'Borrow out of range');

    }),

        it("mint redeem eth test", async () => {
            let weth = await utils.createWETH();
            let controller = await utils.createController(accounts[0]);
            let createPoolResult = await utils.createPool(accounts[0], controller, admin, weth);
            let erc20Pool = createPoolResult.pool;
            let mintAmount = toWei(1);
            //deposit 1
            let ethBegin = await web3.eth.getBalance(admin);
            m.log("ethBegin=", ethBegin);
            let tx = await erc20Pool.mintEth({value: mintAmount});
            m.log("MintEth Gas Used: ", tx.receipt.gasUsed);
            assert.equal((await erc20Pool.getCash()).toString(), mintAmount.toString());
            assert.equal((await erc20Pool.totalSupply()).toString(), mintAmount.toString());
            //redeem
            let ethBefore = await web3.eth.getBalance(admin);
            await erc20Pool.redeemUnderlying(mintAmount);
            assert.equal(await erc20Pool.getCash(), 0);
            assert.equal(await erc20Pool.totalSupply(), 0);
            let ethAfter = await web3.eth.getBalance(admin);
            m.log("ethBefore=", ethBefore);
            m.log("ethAfter=", ethAfter);
            assert.equal(toBN(ethAfter).gt(toBN(ethBefore)), true);
        })

    it("Depositor deposit eth redeem test", async () => {
        let weth = await utils.createWETH();
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin, weth);
        let erc20Pool = createPoolResult.pool;
        let poolDepositor = await LPoolDepositor.new();
        let mintAmount = toWei(1);
        //deposit 1
        let ethBegin = await web3.eth.getBalance(admin);
        m.log("ethBegin=", ethBegin);
        let tx = await poolDepositor.depositNative(erc20Pool.address, {value: mintAmount});
        m.log("DepositEth Gas Used: ", tx.receipt.gasUsed);
        assert.equal((await erc20Pool.getCash()).toString(), mintAmount.toString());
        assert.equal((await erc20Pool.totalSupply()).toString(), mintAmount.toString());
        //redeem
        let ethBefore = await web3.eth.getBalance(admin);
        await erc20Pool.redeemUnderlying(mintAmount);
        assert.equal(await erc20Pool.getCash(), 0);
        assert.equal(await erc20Pool.totalSupply(), 0);
        let ethAfter = await web3.eth.getBalance(admin);
        m.log("ethBefore=", ethBefore);
        m.log("ethAfter=", ethAfter);
        assert.equal(toBN(ethAfter).gt(toBN(ethBefore)), true);
    })

    it("Depositor deposit erc20 redeem test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 1);
        let poolDepositor = await LPoolDepositor.new();
        let mintAmount = toWei(1);
        //deposit 1
        await testToken.approve(poolDepositor.address, maxUint());
        let tx = await poolDepositor.deposit(erc20Pool.address, mintAmount);
        m.log("DepositErc20 Gas Used: ", tx.receipt.gasUsed);
        assert.equal((await erc20Pool.getCash()).toString(), mintAmount.toString());
        assert.equal((await erc20Pool.totalSupply()).toString(), mintAmount.toString());
        //redeem
        await erc20Pool.redeemUnderlying(mintAmount);
        assert.equal(await erc20Pool.getCash(), 0);
        assert.equal(await erc20Pool.totalSupply(), 0);
        assert.equal(toWei(1).toString(), (await testToken.balanceOf(admin)).toString());
    })
    it("Supply -> raise Balance -> supply -> redeem", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let blocksPerYear = toBN(2102400);
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        let cash = await erc20Pool.getCash();
        assert.equal(cash, 0);
        /**
         * deposit
         */
        //deposit10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(utils.toWei(10000));
        await erc20Pool.setReserveFactor(toBN(2e17));
        //Checking deposits
        assert.equal(await erc20Pool.getCash(), utils.toWei(10000).toString());
        assert.equal(await erc20Pool.totalSupply(), utils.toWei(10000).toString());
        //Check deposit rate
        assert.equal(await erc20Pool.supplyRatePerBlock(), 0);
        //Check loan interest rate
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');

        /* raise balance */
        await utils.mint(testToken, erc20Pool.address, 10000);
        assert.equal(await erc20Pool.getCash(), utils.toWei(20000).toString());
        assert.equal(await erc20Pool.totalSupply(), utils.toWei(10000).toString());
        assert.equal(await erc20Pool.supplyRatePerBlock(), 0);
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');

        /* deposit again by another account*/
        await utils.mint(testToken, accounts[1], 20000);
        await testToken.approve(erc20Pool.address, maxUint(), {from: accounts[1]});
        await erc20Pool.mint(utils.toWei(20000), {from: accounts[1]});

        assert.equal(await erc20Pool.getCash(), utils.toWei(40000).toString());
        assert.equal(await erc20Pool.totalSupply(), utils.toWei(20000).toString());
        assert.equal(await erc20Pool.supplyRatePerBlock(), 0);
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');

        /* Withdrawal
         */
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 0);
        assert.equal((await testToken.balanceOf(accounts[0])).toString(), utils.toWei(20000).toString());

        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[1]))[0], {from: accounts[1]});
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[1]);
        assert.equal(accountSnapshot[0], 0);
        assert.equal((await testToken.balanceOf(accounts[1])).toString(), utils.toWei(20000).toString());

        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '0');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), 1e18);
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '0');
    })

    it("Supply -> borrow -> supply more -> raise -> borrow more -> redeem partial -> repay -> redeem all", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let blocksPerYear = toBN(2102400);
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        let cash = await erc20Pool.getCash();
        assert.equal(cash, 0);
        /**
         * deposit
         */
        //deposit10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(utils.toWei(10000));
        await erc20Pool.setReserveFactor(toBN(2e17));
        //Checking deposits
        assert.equal(await erc20Pool.getCash(), utils.toWei(10000).toString());
        assert.equal(await erc20Pool.totalSupply(), utils.toWei(10000).toString());
        //Check deposit rate
        assert.equal(await erc20Pool.supplyRatePerBlock(), 0);
        //Check loan interest rate
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');

        /**
         * borrow money
         */
        //borrow money5000
        await erc20Pool.borrowBehalf(borrower0, utils.toWei(5000), {from: borrower0});
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '99999999996537600');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '39999999997353600');
        //inspect snapshot
        let accountSnapshot = await erc20Pool.getAccountSnapshot(borrower0);
        assert.equal(accountSnapshot[0], 0);
        assert.equal(accountSnapshot[1], utils.toWei(5000).toString());
        assert.equal(accountSnapshot[2], 1e18);

        /* deposit again by another account*/
        await utils.mint(testToken, lender0, 20000, {from: lender0});
        await testToken.approve(erc20Pool.address, maxUint(), {from: lender0});
        await erc20Pool.mint(utils.toWei(20000), {from: lender0});

        assert.equal(await erc20Pool.getCash(), utils.toWei(25000).toString());
        assert.equal(await erc20Pool.totalSupply(), '29999998858447553797103');
        assert.equal(await erc20Pool.supplyRatePerBlock(), '4227972917');
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '66666668725411200');

        /* raise balance */
        await utils.mint(testToken, erc20Pool.address, 60000);
        assert.equal(await erc20Pool.getCash(), utils.toWei(85000).toString());
        assert.equal(await erc20Pool.totalSupply(), '29999998858447553797103');
        assert.equal(await erc20Pool.supplyRatePerBlock(), "1174436916");
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '55555556310028800');

        //Borrow 5000 more
        await erc20Pool.borrowBehalf(borrower0, utils.toWei(5000), {from: borrower0});
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '61111112098291200');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '5432099336640000');
        accountSnapshot = await erc20Pool.getAccountSnapshot(borrower0);
        assert.equal(accountSnapshot[1], '10000000977718627436659');
        assert.equal(accountSnapshot[2].toString(), '3000000140227746687');

        //Total borrowings
        assert.equal(await erc20Pool.totalBorrows(), '10000000977718627436659');
        //Update total borrowings and interest
        await erc20Pool.accrueInterest();
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '61111112392627200');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '5432099506934400');
        //rate of exchange
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), '3000000147979030350');

        /**
         * Withdrawal partial
         */
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(lender0))[0], {from: lender0});
        accountSnapshot = await erc20Pool.getAccountSnapshot(lender0);
        assert.equal(accountSnapshot[0], 0);
        assert.equal(await erc20Pool.totalSupply(), utils.toWei(10000).toString());
        assert.equal((await testToken.balanceOf(lender0)).toString(), "59999999689948769136987");
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '83333336796604800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '22222225455177600');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), "3000000155730314277");
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '13999999686777624331795');

        /**
         * repayment
         */
        await utils.mint(testToken, borrower0, 10000);
        await testToken.approve(erc20Pool.address, maxUint(), {from: borrower0});
        await erc20Pool.repayBorrowBehalf(borrower0, maxUint(), {from: borrower0});
        accountSnapshot = await erc20Pool.getAccountSnapshot(borrower0);
        assert.equal(accountSnapshot[0], 0);
        assert.equal(accountSnapshot[1], 0);
        //Total borrowings
        assert.equal(await erc20Pool.totalBorrows(), 0);
        //Total deposit
        //Loan interest rate and deposit interest rate
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '0');
        //rate of exchange
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), '3000000250859709013');

        /**
         * Withdrawal all
         */
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 0);
        assert.equal((await testToken.balanceOf(accounts[0])).toString(), "30000002508597090130000");
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '49999999998268800');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '0');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), 1e18);
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '1540');
    })
    
    it("pool not allowed test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let testToken = createPoolResult.token;
        let erc20Pool = createPoolResult.pool;
        await utils.mint(testToken, admin, 10000);
        //deposit 10000
        await testToken.approve(erc20Pool.address, maxUint());
        controller.setLPoolUnAllowed(await erc20Pool.address, true);
        await assertThrows(erc20Pool.mint(10000 * 1e10), 'LPool paused');
    })

    it("pool change admin test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let newAdmin = accounts[1];
        await erc20Pool.setPendingAdmin(newAdmin);
        assert.equal(newAdmin, await erc20Pool.pendingAdmin());
        await erc20Pool.acceptAdmin({from: accounts[1]});
        assert.equal(newAdmin, await erc20Pool.admin());
        assert.equal("0x0000000000000000000000000000000000000000", await erc20Pool.pendingAdmin());
    })

    it("reverses test ", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let blocksPerYear = toBN(2102400);
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 10000);
        await erc20Pool.setReserveFactor(toBN(2e17));
        //deposit 9000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(toWei(9000));
        //borrow 1000
        await erc20Pool.borrowBehalf(accounts[0], toWei(1000));
        //advance 1000 blocks
        await advanceMultipleBlocks(1000);
        //repay
        await erc20Pool.repayBorrowBehalf(accounts[0], maxUint());
        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0].toString(), toWei(9000).toString());
        assert.equal(accountSnapshot[1], 0);
        //
        assert.equal(await erc20Pool.totalBorrows(), 1);
        //withdrawal
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        let totalBorrows = await erc20Pool.totalBorrows();
        let totalCash = await erc20Pool.getCash();
        let reserves = await erc20Pool.totalReserves();
        m.log("totalBorrows", totalBorrows);
        m.log("totalCash ", totalCash);
        m.log("reserves", reserves);

        accountSnapshot = await erc20Pool.getAccountSnapshot(accounts[0]);
        assert.equal(accountSnapshot[0], 0);
        assert.equal((await testToken.balanceOf(accounts[0])).toString(), "9999994180724674728001");
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '50011627903833600');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '4652243280000');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), 1e18);
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '6879');
        assert.equal(reserves.toString(), '5819275325263400');
        //reduce reserves
        await erc20Pool.reduceReserves(accounts[1], '1819275325263400');
        let reservesAfterReduce = await erc20Pool.totalReserves();
        assert.equal(reservesAfterReduce.toString(), '4000000000000000');
        assert.equal((await erc20Pool.borrowRatePerBlock()).mul(blocksPerYear).toString(), '50011627903833600');
        assert.equal((await erc20Pool.supplyRatePerBlock()).mul(blocksPerYear).toString(), '4652243280000');
        assert.equal((await erc20Pool.exchangeRateStored()).toString(), 1e18);
        assert.equal((await erc20Pool.availableForBorrow()).toString(), '6879');
        assert.equal((await testToken.balanceOf(accounts[1])).toString(), '1819275325263400');
        assert.equal((await erc20Pool.getCash()).toString(), '4000000000008599');
        // add reserves
        await erc20Pool.addReserves('1000000000000000');
        assert.equal((await erc20Pool.totalReserves()).toString(), '5000000000000000');
        assert.equal((await erc20Pool.getCash()).toString(), '5000000000008599');


    })

    it("update interestParams test", async () => {
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;
        //5% base 100000 blocks
        await erc20Pool.setInterestParams(toBN(5e16).div(toBN(100000)), toBN(10e16).div(toBN(100000)), toBN(20e16).div(toBN(100000)), 50e16 + '');
        await erc20Pool.setReserveFactor(toBN(2e17));

        await utils.mint(testToken, admin, toWei(100000));
        // deposit 10000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(toWei(10000));
        //borrow 5000
        await erc20Pool.borrowBehalf(accounts[0], toWei(4000), {from: accounts[1]});
        // advance 1000 blocks
        await advanceMultipleBlocks(1000);
        // check borrows=4000+(5%+10%*40%)*4000*1000/100000
        let borrowsBefore = await erc20Pool.borrowBalanceCurrent(accounts[0]);
        m.log("borrowsBefore =", borrowsBefore.toString());
        assert.equal("4003599999999999999999", borrowsBefore.toString());
        //base interest change to 10% 100000 blocks
        await erc20Pool.setInterestParams(toBN(10e16).div(toBN(100000)), toBN(10e16).div(toBN(100000)), toBN(20e16).div(toBN(100000)), 50e16 + '');
        let borrowsAfterUpdate = await erc20Pool.borrowBalanceCurrent(accounts[0]);
        let totalBorrowsAfterUpdate = await erc20Pool.totalBorrowsCurrent();
        let totalBorrowsStoredAfterUpdate = await erc20Pool.totalBorrows();
        let baseRatePerBlockAfterUpdate = await erc20Pool.baseRatePerBlock();
        // check borrows=4000+(5%+10%*40%)*4000*1001/100000
        m.log("borrowsAfterUpdate =", borrowsAfterUpdate.toString());
        m.log("totalBorrowsAfterUpdate =", totalBorrowsAfterUpdate.toString());
        m.log("totalBorrowsStoredAfterUpdate =", totalBorrowsStoredAfterUpdate.toString());
        m.log("baseRatePerBlockAfterUpdate =", baseRatePerBlockAfterUpdate.toString());
        assert.equal("4003603599999999999999", borrowsAfterUpdate.toString());
        assert.equal("4003603600000000000000", totalBorrowsAfterUpdate.toString());
        assert.equal("1000000000000", baseRatePerBlockAfterUpdate.toString());
        // advance 1000 blocks
        await advanceMultipleBlocks(1000);
        m.log("advance 1000 blocks...");
        // check borrows=4000.36+(10%+10%*40%)*4000.36*1000/100000
        borrowsAfterUpdate = await erc20Pool.borrowBalanceCurrent(accounts[0]);
        totalBorrowsAfterUpdate = await erc20Pool.totalBorrowsCurrent();
        m.log("borrowsAfterUpdate =", borrowsAfterUpdate.toString());
        m.log("totalBorrowsAfterUpdate =", totalBorrowsAfterUpdate.toString());
        assert.equal("4009209625819492940633", borrowsAfterUpdate.toString());
        assert.equal("4009209625819492940633", totalBorrowsAfterUpdate.toString());
        // repay
        await erc20Pool.repayBorrowBehalf(accounts[0], maxUint());
        m.log("after repay...");
        borrowsAfterUpdate = await erc20Pool.borrowBalanceCurrent(accounts[0]);
        totalBorrowsAfterUpdate = await erc20Pool.totalBorrowsCurrent();
        assert.equal("0", borrowsAfterUpdate.toString());
        assert.equal("0", totalBorrowsAfterUpdate.toString());
        // redeem
        await erc20Pool.redeem((await erc20Pool.getAccountSnapshot(accounts[0]))[0]);
        let cashInPool = await erc20Pool.getCash();
        let reserves = await erc20Pool.totalReserves();
        //184,3046,3690,6248,6714
        m.log("cashInPool =", cashInPool.toString());
        m.log("reserves =", reserves.toString());
        let avaiableCash = cashInPool.sub(reserves);
        m.log("avaiableCash =", avaiableCash.toString());
        assert.equal("1843046369062493574", cashInPool.toString());
        assert.equal("1843046369062486714", reserves.toString());
        assert.equal("6860", avaiableCash.toString());


    })

    /*** Admin Test ***/

    it("Admin setController test", async () => {
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;
        let newController = await utils.createController(accounts[0]);

        await timeLock.executeTransaction(erc20Pool.address, 0, 'setController(address)',
            web3.eth.abi.encodeParameters(['address'], [newController.address]), 0)
        assert.equal(newController.address, await erc20Pool.controller());
        await assertThrows(erc20Pool.setController(newController.address), 'caller must be admin');
    })

    it("Admin setBorrowCapFactorMantissa test", async () => {
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;

        await timeLock.executeTransaction(erc20Pool.address, 0, 'setBorrowCapFactorMantissa(uint256)',
            web3.eth.abi.encodeParameters(['uint256'], [1]), 0)
        assert.equal(1, await erc20Pool.borrowCapFactorMantissa());
        await assertThrows(erc20Pool.setBorrowCapFactorMantissa(1), 'caller must be admin');

    })

    it("Admin setInterestParams test", async () => {
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;

        await timeLock.executeTransaction(erc20Pool.address, 0, 'setInterestParams(uint256,uint256,uint256,uint256)',
            web3.eth.abi.encodeParameters(['uint256', 'uint256', 'uint256', 'uint256'], [0, 1, 2, 3]), 0)
        assert.equal(0, await erc20Pool.baseRatePerBlock());
        assert.equal(1, await erc20Pool.multiplierPerBlock());
        assert.equal(2, await erc20Pool.jumpMultiplierPerBlock());
        assert.equal(3, await erc20Pool.kink());
        await assertThrows(erc20Pool.setInterestParams(0, 1, 2, 3), 'caller must be admin');
    })

    it("Admin setReserveFactor test", async () => {
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;

        await timeLock.executeTransaction(erc20Pool.address, 0, 'setReserveFactor(uint256)',
            web3.eth.abi.encodeParameters(['uint256'], [3]), 0)
        assert.equal(3, await erc20Pool.reserveFactorMantissa());
        await assertThrows(erc20Pool.setReserveFactor(3), 'caller must be admin');
    })

    it("Admin reduceReserves test", async () => {
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;

        await utils.mint(testToken, admin, 1);
        await testToken.approve(erc20Pool.address, 1);
        await erc20Pool.addReserves(1);

        await timeLock.executeTransaction(erc20Pool.address, 0, 'reduceReserves(address,uint256)',
            web3.eth.abi.encodeParameters(['address', 'uint256'], [accounts[1], 1]), 0)
        await assertThrows(erc20Pool.reduceReserves(accounts[1], 1), 'caller must be admin');
    })

    it("Admin setImplementation test", async () => {
        let instance = await LPool.new();
        let timeLock = await utils.createTimelock(admin);
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, timeLock.address);
        let erc20Pool = createPoolResult.pool;
        await timeLock.executeTransaction(erc20Pool.address, 0, 'setImplementation(address)',
            web3.eth.abi.encodeParameters(['address'], [instance.address]), 0)
        assert.equal(instance.address, await erc20Pool.implementation());
        await assertThrows((await LPoolDelegator.at(erc20Pool.address)).setImplementation(instance.address), 'caller must be admin');
    });


})
