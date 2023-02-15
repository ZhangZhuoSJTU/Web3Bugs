const {toBN} = require("./utils/EtheUtil");

const {toWei, lastBlockTime, toETH, firstStr, assertThrows} = require("./utils/OpenLevUtil");
const TimeLock = artifacts.require("OLETokenLock");
const OLEToken = artifacts.require("OLEToken");


const m = require('mocha-logger');

const timeMachine = require('ganache-time-traveler');

contract("OLETokenLock", async accounts => {
    before(async () => {

    });

    it("Take out all at one time, the time has expired: ", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], ['1599372311'], [(parseInt(await lastBlockTime()))]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeLock.release(accounts[1]);
        assert.equal((await timeLock.releaseAbleAmount(accounts[1])), 0);
        // Comparison of results
        assert.equal(toBN(100000).mul(toBN(1e18)).toString(), (await oleToken.balanceOf(accounts[1])).toString());

    });

    it("The withdrawal address is non beneficiary: ", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], ['1599372311'], [(parseInt(await lastBlockTime()))]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await assertThrows(timeLock.release(accounts[2]), 'beneficiary does not exist');
    });

    it("Cash withdrawal before start time:", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], [(parseInt(await lastBlockTime()) + 30000).toString().substr(0, 10)], [(parseInt(await lastBlockTime()) + 60000) + ""]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await assertThrows(timeLock.release(accounts[1]), 'not time to unlock');

    });


    it("Withdraw twice, is the amount correct each time: ", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], ['1599372311'], [(parseInt(await lastBlockTime()) + 30000)]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeLock.release(accounts[1]);
        assert.equal(firstStr("999", 3), firstStr((await oleToken.balanceOf(accounts[1])).toString(), 3));

        m.log("Wait for 10 seconds ....");
        let takeSnapshot = await timeMachine.takeSnapshot();
        let shotId = takeSnapshot['result'];
        await timeMachine.advanceTime(30000);
        await timeLock.release(accounts[1]);

        // Comparison of results
        assert.equal(firstStr("99999", 5), firstStr((await oleToken.balanceOf(accounts[1])).toString(), 5));
        await timeMachine.revertToSnapshot(shotId);

    });


    it("After one withdrawal, is the result correct at end time", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');

        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], ['1599372311'], [(parseInt(await lastBlockTime()) + 30000)]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeLock.release(accounts[1]);
        // comparison of results
        assert.equal(firstStr("999", 3), firstStr((await oleToken.balanceOf(accounts[1])).toString(), 3));

        m.log("Wait for 10 seconds ....");
        let takeSnapshot = await timeMachine.takeSnapshot();
        let shotId = takeSnapshot['result'];
        await timeMachine.advanceTime(30000);
        await timeLock.release(accounts[1]);

        //comparison of results
        assert.equal(firstStr("99999999", 8), firstStr((await oleToken.balanceOf(accounts[1])).toString(), 8));
        await timeMachine.revertToSnapshot(shotId);


    });


    it("If the withdrawal is completed, is it wrong to withdraw again: ", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        // 2020-09-06 14:05:11  2021-01-01 14:05:11
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)], ['1599372311'], [(parseInt(await lastBlockTime()))]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeLock.release(accounts[1]);
        // comparison of results
        assert.equal(toWei(100000).toString(), (await oleToken.balanceOf(accounts[1])).toString());
        await assertThrows(timeLock.release(accounts[1]), 'no amount available');
    });


    it("Two accounts, two addresses, partial withdrawal: ", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        // 2020-09-06 14:05:11  2021-01-01 14:05:11
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1], accounts[3]], [toWei(100000), toWei(100000)],
            ['1599372311', '1599372311'], [(parseInt(await lastBlockTime()) + 0) + "", (parseInt(await lastBlockTime()) + 0) + ""]);

        await oleToken.transfer(timeLock.address, toWei(100000));

        await timeLock.release(accounts[1]);

        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeLock.release(accounts[3])

        // comparison of results
        assert.equal(toWei(100000).toString(), (await oleToken.balanceOf(accounts[1])).toString());

        assert.equal(toWei(100000).toString(), (await oleToken.balanceOf(accounts[3])).toString());

    });

    it("transfer to A error with beneficiary does not exist test", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)],
            [parseInt(await lastBlockTime())], [parseInt(await lastBlockTime()) + 10000]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeMachine.advanceTime(5000);
        await assertThrows(timeLock.transferTo(accounts[2], toWei(20000), {from: accounts[3]}), 'beneficiary does not exist');
    });

    it("transfer to A  error with locked end test", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)],
            [parseInt(await lastBlockTime())], [parseInt(await lastBlockTime()) + 1000]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        await timeMachine.advanceTime(1001);
        await assertThrows(timeLock.transferTo(accounts[2], toWei(20000), {from: accounts[1]}), 'locked end');
    });

    it("transfer to a exit account error with to is exist test", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1],accounts[2]], [toWei(100000),toWei(100000)],
            [parseInt(await lastBlockTime()),parseInt(await lastBlockTime())], [parseInt(await lastBlockTime()) + 1000,parseInt(await lastBlockTime()) + 1000]);
        await oleToken.transfer(timeLock.address, toWei(200000));
        await timeMachine.advanceTime(10);
        await assertThrows(timeLock.transferTo(accounts[2], toWei(20000), {from: accounts[1]}), 'to is exist');

    });
    it("transfer to A succeed test", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)],
            [parseInt(await lastBlockTime())], [parseInt(await lastBlockTime()) + 10000]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        let shotId = (await timeMachine.takeSnapshot())['result'];
        await timeMachine.advanceTime(5000);
        await timeLock.release(accounts[1]);
        await timeMachine.advanceTime(1000);
        await timeLock.transferTo(accounts[2], toWei(20000), {from: accounts[1]});
        await timeMachine.advanceTime(4000);
        await timeLock.release(accounts[1]);
        await timeLock.release(accounts[2]);
        assert.equal((await timeLock.releaseVars(accounts[1])).end,(await timeLock.releaseVars(accounts[2])).end);

        // comparison of results
        assert.equal(toWei(80000).toString(), (await oleToken.balanceOf(accounts[1])).toString());
        assert.equal(toWei(20000).toString(), (await oleToken.balanceOf(accounts[2])).toString());
        await timeMachine.revertToSnapshot(shotId);
    });
    it("transfer to A,A transfer to B test", async () => {
        let oleToken = await OLEToken.new(accounts[0], accounts[0], 'TEST', 'TEST');
        let timeLock = await TimeLock.new(oleToken.address, [accounts[1]], [toWei(100000)],
            [parseInt(await lastBlockTime())], [parseInt(await lastBlockTime()) + 10000]);
        await oleToken.transfer(timeLock.address, toWei(100000));
        let shotId = (await timeMachine.takeSnapshot())['result'];
        await timeMachine.advanceTime(5000);
        await timeLock.release(accounts[1]);
        await timeMachine.advanceTime(1000);
        await timeLock.transferTo(accounts[2], toWei(20000), {from: accounts[1]});
        await timeMachine.advanceTime(2000);
        await timeLock.transferTo(accounts[3], toWei(5000), {from: accounts[2]});
        await timeMachine.advanceTime(2000);
        assert.equal((await timeLock.releaseVars(accounts[1])).end,(await timeLock.releaseVars(accounts[2])).end);
        assert.equal((await timeLock.releaseVars(accounts[2])).end,(await timeLock.releaseVars(accounts[3])).end);

        await timeLock.release(accounts[1]);
        await timeLock.release(accounts[2]);
        await timeLock.release(accounts[3]);
        // comparison of results
        assert.equal(toWei(80000).toString(), (await oleToken.balanceOf(accounts[1])).toString());
        assert.equal(toWei(15000).sub(await oleToken.balanceOf(accounts[2])).lt(toBN(100)), true);
        assert.equal(toWei(5000).sub(await oleToken.balanceOf(accounts[2])).lt(toBN(100)), true);

        await timeMachine.revertToSnapshot(shotId);

    });
})


