const {toBN, maxUint, advanceBlockAndSetTime} = require("./utils/EtheUtil");

const {toWei, toETH, assertThrows,} = require("./utils/OpenLevUtil");


const MockERC20 = artifacts.require("MockERC20");
const FarmingPool = artifacts.require("FarmingPools");

const m = require('mocha-logger');
const utils = require("./utils/OpenLevUtil");

contract("FarmingPools", async accounts => {
    let oleToken;
    let stakeToken1;
    let stakeToken2;
    let stakeToken3;
    let farmingPools;
    let admin = accounts[0];
    let stakeAcc1 = accounts[1];
    let stakeAcc2 = accounts[2];
    let day1 = 24 * 60 * 60;
    beforeEach(async () => {
        oleToken = await MockERC20.new('OLEToken', 'OLE');
        stakeToken1 = await MockERC20.new('StakeToken1', 'ST1');
        stakeToken2 = await MockERC20.new('StakeToken2', 'ST2');
        stakeToken3 = await MockERC20.new('StakeToken3', 'ST3');
        farmingPools = await FarmingPool.new(oleToken.address, admin);
        await oleToken.mint(admin, toWei(10000));

    });

    it("One pool and one account: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(10000));
        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        let amount = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        assert.equal("0", "0");
        m.log("Earn before: ", amount.toString());
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        m.log("Earn after 1h: ", amount.toString());
        assert.equal("999", scaleEth(amount, 10).toString());
        let tx = await farmingPools.getReward(stakeToken1.address, {from: stakeAcc1});
        m.log("GetReward one Gas Used: ", tx.receipt.gasUsed);
        assert.equal("999", scaleEth(amount, 10).toString());
        await farmingPools.withdraw(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        assert.equal(toWei(1000).toString(), await stakeToken1.balanceOf(stakeAcc1));
    });

    it("One pool and two account: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(10000));
        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        await stakeToken1.mint(stakeAcc2, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc2});
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc2});
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        let amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        let amount2 = await farmingPools.earned(stakeToken1.address, stakeAcc2);
        assert.equal("499", scaleEth(amount1, 10).toString());
        assert.equal("499", scaleEth(amount2, 10).toString());
    });

    it("Two pool and one account: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address, stakeToken2.address], [lastTs, lastTs], [day1, day1 * 2]);
        await oleToken.mint(farmingPools.address, toWei(30000));
        await farmingPools.notifyRewardAmounts([stakeToken1.address, stakeToken2.address], [toWei(10000), toWei(20000)]);

        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});

        await stakeToken2.mint(stakeAcc1, toWei(10000));
        await stakeToken2.approve(farmingPools.address, toWei(10000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken2.address, toWei(10000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        let amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        let amount2 = await farmingPools.earned(stakeToken2.address, stakeAcc1);
        assert.equal("999", scaleEth(amount1, 10).toString());
        assert.equal("999", scaleEth(amount2, 10).toString());
        lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        amount2 = await farmingPools.earned(stakeToken2.address, stakeAcc1);
        assert.equal("999", scaleEth(amount1, 10).toString());
        assert.equal("1999", scaleEth(amount2, 10).toString());
        let tx = await farmingPools.getRewards([stakeToken1.address, stakeToken2.address], {from: stakeAcc1});
        m.log("GetReward two Gas Used: ", tx.receipt.gasUsed);

    });

    it("Two pool and two account: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address, stakeToken2.address], [lastTs, lastTs], [day1, day1 * 2]);
        await oleToken.mint(farmingPools.address, toWei(30000));
        await farmingPools.notifyRewardAmounts([stakeToken1.address, stakeToken2.address], [toWei(10000), toWei(20000)]);

        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});

        await stakeToken2.mint(stakeAcc1, toWei(10000));
        await stakeToken2.approve(farmingPools.address, toWei(10000), {from: stakeAcc1});
        await farmingPools.stake(stakeToken2.address, toWei(10000), {from: stakeAcc1});

        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        await stakeToken2.mint(stakeAcc2, toWei(10000));
        await stakeToken2.approve(farmingPools.address, toWei(10000), {from: stakeAcc2});
        await farmingPools.stake(stakeToken2.address, toWei(10000), {from: stakeAcc2});

        lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        amount2 = await farmingPools.earned(stakeToken2.address, stakeAcc1);
        amount3 = await farmingPools.earned(stakeToken2.address, stakeAcc2);
        assert.equal("999", scaleEth(amount1, 10).toString());
        assert.equal("1499", scaleEth(amount2, 10).toString());
        assert.equal("499", scaleEth(amount3, 10).toString());

    });

    it("One pool exit: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(10000));
        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        let amount = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        await farmingPools.exit(stakeToken1.address, {from: stakeAcc1});
        assert.equal(toWei(1000).toString(), await stakeToken1.balanceOf(stakeAcc1));
        assert.equal(amount.toString(), await oleToken.balanceOf(stakeAcc1));
    });

    it("One pool withdraw half: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(10000));
        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 / 2);
        amount = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        //withdraw half
        await farmingPools.withdraw(stakeToken1.address, toWei(500), {from: stakeAcc1});

        await stakeToken1.mint(stakeAcc2, toWei(500));
        await stakeToken1.approve(farmingPools.address, toWei(500), {from: stakeAcc2});
        await farmingPools.stake(stakeToken1.address, toWei(500), {from: stakeAcc2});
        lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        amount2 = await farmingPools.earned(stakeToken1.address, stakeAcc2);
        assert.equal("749", scaleEth(amount1, 10).toString());
        assert.equal(true, scaleEth(amount2, 10).toString()=="249"||scaleEth(amount2, 10).toString()=="250");
    });


    it("One pool distribute more: ", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(10000));
        await stakeToken1.mint(stakeAcc1, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + 10);
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc1});
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        //more
        await oleToken.mint(farmingPools.address, toWei(20000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(20000));
        await stakeToken1.mint(stakeAcc2, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc2});
        await farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc2});
        lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await advanceBlockAndSetTime(parseInt(lastTs) + day1 + 10);
        amount1 = await farmingPools.earned(stakeToken1.address, stakeAcc1);
        amount2 = await farmingPools.earned(stakeToken1.address, stakeAcc2);
        assert.equal("1999", scaleEth(amount1, 10).toString());
        assert.equal("999", scaleEth(amount2, 10).toString());
    });

    it("Not start test", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs + day1], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await farmingPools.notifyRewardAmount(stakeToken1.address, toWei(20000), {from: admin});
        await stakeToken1.mint(stakeAcc2, toWei(1000));
        await stakeToken1.approve(farmingPools.address, toWei(1000), {from: stakeAcc2});
        await assertThrows(farmingPools.stake(stakeToken1.address, toWei(1000), {from: stakeAcc2}), 'not start');
    })

    it("Init once test", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs + day1], [day1]);
        await assertThrows(farmingPools.initDistributions([stakeToken1.address], [lastTs + day1], [day1]), 'Init once');
    })

    // Admin Test
    it("Admin initDistributions test", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await assertThrows(farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1], {from: stakeAcc1}), 'caller must be admin');
    })

    it("Admin notifyRewardAmount test", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await assertThrows(farmingPools.notifyRewardAmount(stakeToken1.address, toWei(20000), {from: stakeAcc1}), 'caller must be admin');
    })
    it("Admin notifyRewardAmounts test", async () => {
        let lastTs = (await web3.eth.getBlock('latest')).timestamp;
        await farmingPools.initDistributions([stakeToken1.address], [lastTs], [day1]);
        await oleToken.mint(farmingPools.address, toWei(10000));
        await assertThrows(farmingPools.notifyRewardAmounts([stakeToken1.address], [toWei(20000)], {from: stakeAcc1}), 'caller must be admin');
    })

    function scaleEth(w, s) {
        return toETH(w).div(toBN(s));
    }
})


