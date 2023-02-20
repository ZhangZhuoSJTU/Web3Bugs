const { constants } = require('../utils/constants');
const NonRebasingGToken = artifacts.require('NonRebasingGToken');
const MockController = artifacts.require('MockController');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDC');
const { BN } = web3.utils;
const { expect, decodeLogs } = require('../utils/common-utils');

contract('NonRebasingGToken Test', function (accounts) {
    const initBase = new BN('3333333333333333')
    const governance = accounts[9],
        investor1 = accounts[5],
        investor2 = accounts[6],
        investor3 = accounts[7],
        deployer = accounts[0];

    let gvt,
        baseNum, daiBaseNum, usdcBaseNum,
        mockDAI, mockUSDC, mockUSDT,
        mockController;

    beforeEach(async function () {
        mockDAI = await MockDAI.new();
        mockUSDC = await MockUSDC.new();
        mockUSDT = await MockUSDT.new();
        mockController = await MockController.new({ from: governance });
        await mockController.setUnderlyingTokens(
            [mockDAI.address, mockUSDC.address, mockUSDT.address], { from: governance });

        gvt = await NonRebasingGToken.new('GVT', 'GVT');
        await gvt.setController(mockController.address);
        await gvt.addToWhitelist(mockController.address, { from: deployer });
        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        baseNum = new BN(10).pow(await gvt.decimals());

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
    })

    describe('factor', function () {
        const BASE = new BN(10).pow(new BN(18));
        beforeEach(async function () {
            if (this.currentTest.title === 'Should be BASE value initially') return;

            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor1 });
        });

        it('Should be BASE value initially', function () {
            return expect(gvt.factor()).to.eventually.be.a.bignumber.equal(initBase);
        });

        it('Should be zero when total assets dropped to zero', async function () {
            await mockController.setGTokenTotalAssets(0);

            return expect(gvt.factor()).to.eventually.be.a.bignumber.equal(new BN(0));
        });

        it('Should be correct when total assets == total supply', async function () {
            return expect(gvt.factor()).to.eventually.be.a.bignumber.equal(initBase);
        });

        it('Should be correct when total assets > total supply', async function () {
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
            return expect(gvt.factor()).to.eventually.be.a.bignumber.equal(initBase.div(new BN(2)));
        });

        it('Should be correct when total assets < total supply', async function () {
            await mockController.setGTokenTotalAssets(new BN(100).mul(baseNum));
            return expect(gvt.factor()).to.eventually.be.a.bignumber.equal(initBase.mul(new BN(2)));
        });
    });

    describe('totalSupply', function () {
        beforeEach(async function () {

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            return expect(gvt.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(200).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
            return expect(gvt.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(200).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(100).mul(baseNum));
            return expect(gvt.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(200).mul(baseNum).mul(initBase).div(baseNum));
        });
    });

    describe('balanceOf', function () {
        beforeEach(async function () {

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            return expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(100).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(600).mul(baseNum));
            return expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(100).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum));
            return expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(100).mul(baseNum).mul(initBase).div(baseNum));
        });
    });

    describe('transfer', function () {
        beforeEach(async function () {

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor2 });


        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            await gvt.transfer(
                investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await gvt.transfer(
                investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum));
            await gvt.transfer(
                investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should revert when no enough amount', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            return expect(gvt.transfer(investor2, new BN(101).mul(baseNum),
                { from: investor1 })).to.be.rejectedWith(
                    'ERC20: transfer amount exceeds balance');
        });
    });

    describe('transferFrom', function () {
        beforeEach(async function () {

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            await gvt.approve(
                investor3, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await gvt.transferFrom(
                investor1, investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum),
                { from: investor3 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await gvt.approve(
                investor3, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await gvt.transferFrom(
                investor1, investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum),
                { from: investor3 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum).mul(initBase).div(baseNum));
            await gvt.approve(
                investor3, new BN(50).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            await gvt.transferFrom(
                investor1, investor2, new BN(50).mul(baseNum).mul(initBase).div(baseNum),
                { from: investor3 });
            await expect(gvt.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum).mul(initBase).div(baseNum));
            return expect(gvt.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum).mul(initBase).div(baseNum));
        });

        it('Should revert when no enough amount', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await gvt.approve(
                investor3, new BN(101).mul(baseNum).mul(initBase).div(baseNum), { from: investor1 });
            return expect(gvt.transferFrom(investor1, investor2, new BN(450).mul(baseNum).mul(initBase).div(baseNum),
                { from: investor3 })).to.be.rejectedWith(
                    'ERC20: transfer amount exceeds balance');
        });
    });

    describe('assets', function () {
        const BASE = new BN(10).pow(new BN(18));

        beforeEach(async function () {

            await mockController.mintGTokens(
                gvt.address, new BN(100).mul(baseNum), { from: investor1 });
            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor2 });
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
        });

        it('getPricePerShare', async function () {
            const ta = await mockController.gTokenTotalAssets()
            const ts = await gvt.totalSupply()
            const f = ts.mul(baseNum).div(ta);
            return expect(gvt.getPricePerShare()).to.eventually.be.a.bignumber.closeTo(
                baseNum.mul(ta).div(ts), new BN(1e10));
        });

        it('getShareAssets', async function () {
            const ta = await mockController.gTokenTotalAssets()
            const ts = await gvt.totalSupply()
            const shares = new BN(10).mul(BASE)
            return expect(gvt.getShareAssets(shares)).to.eventually.be.a.bignumber.closeTo(
                shares.mul(ta).div(ts), new BN(1e10));
        });

        it('getAssets', async function () {
            const balance = await gvt.balanceOf(investor1)
            const ta = await mockController.gTokenTotalAssets()
            const ts = await gvt.totalSupply()
            return expect(gvt.getAssets(investor1)).to.eventually.be.a.bignumber.closeTo(
                balance.mul(ta).div(ts), new BN(1e10));
        });
    })

    describe('Rebasing event', function () {
        const BASE = new BN(10).pow(new BN(18));

        it('Burn event', async function () {
            await mockController.mintGTokens(
                gvt.address, new BN(400).mul(baseNum), { from: investor1 }
            );
            const firstBurnAmount = new BN(200).mul(baseNum)
            const factorfirstBurn = await gvt.factor();
            const trx = await mockController.burnGTokens(
                gvt.address, firstBurnAmount, { from: investor1 }
            );
            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const firstBurn = await decodeLogs(tx.logs, NonRebasingGToken, gvt.address, 'Transfer');

            const expectedFirst = firstBurnAmount.mul(factorfirstBurn).div(baseNum);
            assert.strictEqual(firstBurn[0].args.value, expectedFirst.toString());

            await mockController.increaseGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await gvt.balanceOf(investor1);

            const burnAmount = new BN(100).mul(baseNum)
            const factorSencondburn = await gvt.factor();
            const expectedFinal = initAmount.sub(burnAmount.mul(factorSencondburn).div(baseNum));
            const trx2 = await mockController.burnGTokens(
                gvt.address, burnAmount, { from: investor1 }
            );
            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            await decodeLogs(tx2.logs, NonRebasingGToken, gvt.address, 'Transfer');
            const secondBurn = await decodeLogs(tx2.logs, NonRebasingGToken, gvt.address, 'Transfer');

            await expect(gvt.balanceOf(investor1)).
                to.eventually.be.a.bignumber.equal(expectedFinal);
            return assert.strictEqual(
                secondBurn[0].args.value, burnAmount.mul(factorSencondburn).div(baseNum).toString()
            );
        });

        it('Mint event', async function () {
            const firstMintAmount = new BN(200).mul(baseNum)
            const factorfirstMint = await gvt.factor();
            const trx = await mockController.mintGTokens(
                gvt.address, firstMintAmount, { from: investor1 }
            );
            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const firstMint = await decodeLogs(tx.logs, NonRebasingGToken, gvt.address, 'Transfer');

            const expectedFirst = firstMintAmount.mul(factorfirstMint).div(baseNum);

            assert.strictEqual(firstMint[0].args.value, expectedFirst.toString());
            // change factor
            await mockController.setGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await gvt.balanceOf(investor1);

            //second burn with new factor
            const mintAmount = new BN(100).mul(baseNum)
            const factorSecondMint = await gvt.factor();
            const expectedFinal = initAmount.add(mintAmount.mul(factorSecondMint).div(baseNum));
            const trx2 = await mockController.mintGTokens(
                gvt.address, mintAmount, { from: investor1 }
            );
            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            const secondMint = await decodeLogs(tx2.logs, NonRebasingGToken, gvt.address, 'Transfer');

            await expect(gvt.balanceOf(investor1)).
                to.eventually.be.a.bignumber.equal(expectedFinal);
            return assert.strictEqual(
                secondMint[0].args.value, mintAmount.mul(factorSecondMint).div(baseNum).toString()
            );
        });

        it('Transfer event', async function () {
            await mockController.mintGTokens(
                gvt.address, new BN(200).mul(baseNum), { from: investor1 }
            );

            // change factor
            await mockController.setGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await gvt.balanceOf(investor1);

            await expect(gvt.factor()).
                to.eventually.be.a.bignumber.below(new BN(1).mul(baseNum));
            //transfer with new factor
            const trx = await gvt.transfer(
                investor2, '1000000', { from: investor1 }
            );

            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const transfer = await decodeLogs(tx.logs, NonRebasingGToken, gvt.address, 'Transfer');

            assert.strictEqual(transfer[0].args.value, '1000000');

            // transfer from
            const approvalAmount = new BN('1000000000');
            const transferAmount = new BN('1000000')
            await gvt.approve(
                investor2, approvalAmount, { from: investor1 }
            );
            const trx2 = await gvt.transferFrom(
                investor1, investor2, transferAmount, { from: investor2 }
            );

            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            const transferFrom = await decodeLogs(tx2.logs, NonRebasingGToken, gvt.address, 'Transfer');

            await expect(gvt.allowance(investor1, investor2)).
                to.eventually.be.a.bignumber.equal(approvalAmount.sub(transferAmount));
            return assert.strictEqual(transferFrom[0].args.value, transferAmount.toString());
        })
    })

    describe('setController', function () {
        it('ok', async function () {
            await gvt.setController(investor3);
            return expect(gvt.ctrl()).to.eventually.equal(investor3);
        })

        it('revert', async function () {
            return expect(gvt.setController(investor3, { from: investor1 })).to.be.rejectedWith(
                'Ownable: caller is not the owner');
        })
    })
});
