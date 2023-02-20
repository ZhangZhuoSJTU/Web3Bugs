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

    before(async () => {
        // runs once before the first test in this block
    });

    it("Allowed Repay all more than 0%-5% test", async () => {
        let supplyer = accounts[0];
        let borrower = accounts[1];
        let controller = await utils.createController(accounts[0]);
        let createPoolResult = await utils.createPool(accounts[0], controller, admin);
        let erc20Pool = createPoolResult.pool;
        let testToken = createPoolResult.token;
        await utils.mint(testToken, admin, 20000);
        //deposit 9000
        await testToken.approve(erc20Pool.address, maxUint());
        await erc20Pool.mint(toWei(9000));
        //borrow 1000
        await erc20Pool.borrowBehalf(borrower, toWei(1000), {from: borrower});
        // repay error with more than 5%
        await assertThrows(erc20Pool.repayBorrowBehalf(borrower, toWei(1051), {from: supplyer}), 'repay more than 5');
        // repay more than 1% succeed
        await erc20Pool.repayBorrowBehalf(borrower, toWei(1010), {from: supplyer});
        let borrowed = await erc20Pool.borrowBalanceCurrent(borrower);
        let totalBorrowed = await erc20Pool.totalBorrowsCurrent();
        let totalCash = await erc20Pool.getCash();
        assert.equal(borrowed, 0);
        assert.equal(totalBorrowed, 0);
        assert.equal(totalCash, "9010000000000000000000");
    })

})
