const OLEToken = artifacts.require("OLEToken");
const {
    assertPrint,
    approxAssertPrint,
    createEthDexAgg,
    createUniswapV2Factory,
    createXOLE
} = require("./utils/OpenLevUtil");
const m = require('mocha-logger');
const {advanceMultipleBlocksAndTime, advanceBlockAndSetTime, toBN} = require("./utils/EtheUtil");

contract("xOLE", async accounts => {

    let H = 3600;
    let DAY = 86400;
    let WEEK = 7 * DAY;
    let MAXTIME = 126144000;
    let TOL = 120 / WEEK;

    let decimals = "000000000000000000";
    let _1000 = "1000000000000000000000";
    let _500 = "500000000000000000000";

    let bob = accounts[0];
    let alice = accounts[1];
    let admin = accounts[2];
    let dev = accounts[3];

    let uniswapFactory;

    let ole
    let xole;

    let stages = {};

    beforeEach(async () => {
        ole = await OLEToken.new(admin, accounts[0], "Open Leverage Token", "OLE");
        await ole.mint(bob, _1000);
        await ole.mint(alice, _1000);

        uniswapFactory = await createUniswapV2Factory(admin);
        let dexAgg = await createEthDexAgg(uniswapFactory.address, "0x0000000000000000000000000000000000000000", admin);
        xole = await createXOLE(ole.address, admin, dev, dexAgg.address, admin);

        let lastbk = await web3.eth.getBlock('latest');
        let timeToMove = lastbk.timestamp + (WEEK - lastbk.timestamp % WEEK);
        m.log("Move time to start of the week", new Date(timeToMove));
        await advanceBlockAndSetTime(timeToMove);
    })

    it("Create lock, increase amount, increase lock time", async () => {
        await ole.approve(xole.address, _1000 + "0", {"from": alice});
        await ole.approve(xole.address, _1000 + "0", {"from": bob});

        let lastbk = await web3.eth.getBlock('latest');
        let end = lastbk.timestamp + WEEK;
        m.log("Alice creates lock with 500 till time ", end, new Date(end));
        await xole.create_lock(_500, end, {"from": alice});
        assertPrint("Alice locked amount", _500, (await xole.locked(alice)).amount);
        approxAssertPrint("Alice locked end", end, (await xole.locked(alice)).end);
        approxAssertPrint("xOLE Total supply", "500000000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "500000000000000000000", await xole.balanceOf(alice));
        assertPrint("Bob's balance of xOLE", "0", await xole.balanceOf(bob));

        await advanceMultipleBlocksAndTime(10);
        m.log("Alice increase amount with 500");
        await xole.increase_amount(_500, {"from": alice});
        assertPrint("Alice locked amount", _1000, (await xole.locked(alice)).amount);
        approxAssertPrint("Alice locked end", end, (await xole.locked(alice)).end); // end isn't changed
        approxAssertPrint("xOLE Total supply", "1000000000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        assertPrint("Bob's balance of xOLE", "0", await xole.balanceOf(bob));

        await advanceMultipleBlocksAndTime(10);
        m.log("Alice increase lock time by 1 week");
        await xole.increase_unlock_time(end + WEEK, {"from": alice});
        assertPrint("Alice locked amount", _1000, (await xole.locked(alice)).amount);
        approxAssertPrint("Alice locked end", end + WEEK, (await xole.locked(alice)).end); // end isn't changed
        approxAssertPrint("xOLE Total supply", "1000000000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        assertPrint("Bob's balance of xOLE", "0", await xole.balanceOf(bob));
    })


    it("Lock to get voting powers, and withdraw", async () => {

        if (process.env.FASTMODE === 'true') {
            m.log("Skipping this test for FAST Mode");
            return;
        }

        await ole.approve(xole.address, _1000 + "0", {"from": alice});
        await ole.approve(xole.address, _1000 + "0", {"from": bob});

        assertPrint("Totol Supply", "0", await xole.totalSupply());
        assertPrint("Alice's Balance", "0", await xole.balanceOf(alice));
        assertPrint("Bob's Balance", "0", await xole.balanceOf(bob));

        let lastbk = await web3.eth.getBlock('latest');
        stages["before_deposits"] = {bknum: lastbk.number, bltime: lastbk.timestamp};

        let end = lastbk.timestamp + WEEK;
        m.log("Alice creates lock with 1000 till time ", end, new Date(end));
        await xole.create_lock(_1000, end, {"from": alice});
        lastbk = await web3.eth.getBlock('latest');
        stages["alice_deposit"] = {bknum: lastbk.number, bltime: lastbk.timestamp};

        approxAssertPrint("xOLE Total supply", "1000000000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        assertPrint("Bob's balance of xOLE", "0", await xole.balanceOf(bob));


        await advanceMultipleBlocksAndTime(1000);

        approxAssertPrint("xOLE Total supply", "1000000000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        assertPrint("Bob's balance of xOLE", "0", await xole.balanceOf(bob));

        lastbk = await web3.eth.getBlock('latest');
        end = lastbk.timestamp + WEEK * 3;
        m.log("Bob creates lock till time ", end, new Date(end));
        await xole.create_lock(_1000, end, {"from": bob});
        lastbk = await web3.eth.getBlock('latest');
        stages["bob_deposit"] = {bknum: lastbk.number, bltime: lastbk.timestamp};
        m.log("xole.totalSupply()", (await xole.totalSupply()).toString());
        approxAssertPrint("xOLE Total supply", "2020800000000000000000", await xole.totalSupply());
        approxAssertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        approxAssertPrint("Bob's balance of xOLE", "1020800000000000000000", await xole.balanceOf(bob));

        await advanceBlockAndSetTime(end + 60 * 60 * 24);
        lastbk = await web3.eth.getBlock('latest');
        stages["check_point"] = {bknum: lastbk.number, bltime: lastbk.timestamp};
        approxAssertPrint("xOLE Total supply", "2020800000000000000000", await xole.totalSupply());
        assertPrint("Alice's balance of xOLE", "1000000000000000000000", await xole.balanceOf(alice));
        approxAssertPrint("Bob's balance of xOLE", "1020800000000000000000", await xole.balanceOf(bob));
        //
        m.log("Alice withdraw");
        await xole.withdraw({from: alice});

        approxAssertPrint("xOLE Total supply", "1020800000000000000000", await xole.totalSupply());
        assertPrint("Alice's balance of xOLE", "0", await xole.balanceOf(alice));
        approxAssertPrint("Bob's balance of xOLE", "1020800000000000000000", await xole.balanceOf(bob));


    })

})
