const { constants } = require('../utils/constants');
const RebasingGToken = artifacts.require('RebasingGToken');
const MockController = artifacts.require('MockController');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const { BN } = web3.utils;
const { expect, decodeLogs } = require('../utils/common-utils');

contract('RebasingGToken Test', function (accounts) {

    const governance = accounts[9],
        investor1 = accounts[5],
        investor2 = accounts[6],
        investor3 = accounts[7],
        controller = accounts[8],
        deployer = accounts[0];

    let pwrd,
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

        pwrd = await RebasingGToken.new('PWRD', 'PWRD');
        await pwrd.setController(mockController.address);
        await pwrd.addToWhitelist(mockController.address, { from: deployer });
        await pwrd.addToWhitelist(controller, { from: deployer });

        daiBaseNum = new BN(10).pow(await mockDAI.decimals());
        usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
        baseNum = new BN(10).pow(await pwrd.decimals());

        await mockDAI.mint(investor1, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor1, new BN(10000).mul(usdcBaseNum), { from: deployer });
        await mockDAI.mint(investor2, new BN(10000).mul(daiBaseNum), { from: deployer });
        await mockUSDC.mint(investor2, new BN(10000).mul(usdcBaseNum), { from: deployer });
    });

    describe('mint', function () {
        describe('revert', function () {
            it('Should revert when the caller is in whitelist', function () {
                return expect(
                    pwrd.mint(investor1, 1, 100, { from: investor2 })).to.be.rejectedWith(
                        'only whitelist');
            });

            it('Should revert when account is zero', function () {
                return expect(pwrd.mint(constants.ZERO_ADDRESS, 1, 100,
                    { from: controller })).to.be.rejected;
            });

            it('Should revert when amount is zero', function () {
                return expect(
                    pwrd.mint(investor1, 1, 0, { from: controller })).to.be.rejectedWith(
                        'Amount is zero.');
            });
        });

        describe('ok', function () {
            //Here is a workaround way to call GToken.mint method since can't send a transaction from contract address directly

            it('Should ok when single investor', async function () {
                const amount = new BN(100).mul(baseNum);
                await mockController.mintGTokens(pwrd.address, amount);

                return expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(amount);
            });

            it('Should ok when multiply investors', async function () {
                const amount1 = new BN(100).mul(baseNum);
                await mockController.mintGTokens(pwrd.address, amount1, { from: investor1 });
                const amount2 = new BN(200).mul(baseNum);
                await mockController.mintGTokens(pwrd.address, amount2, { from: investor2 });

                await expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                    amount1.add(amount2));
                await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                    amount1);
                return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                    amount2);
            });

        });
    });

    describe('burn', function () {
        describe('revert', function () {
            it('Should revert when the caller is in whitelist', function () {
                return expect(
                    pwrd.burn(investor1, 1, 100, { from: investor2 })).to.be.rejected
            });

            it('Should revert when account is zero', function () {
                return expect(pwrd.burn(constants.ZERO_ADDRESS, 1, 100,
                    { from: controller })).to.be.rejected;
            });

            it('Should revert when amount is zero', function () {
                return expect(
                    pwrd.burn(investor1, 1, 0, { from: controller })).to.be.rejectedWith(
                        'Amount is zero.');
            });
        });

        describe('ok', function () {
            //Here is a workaround way to call GToken.mint method since can't send a transaction from contract address directly

            let initAmount1, initAmount2;
            beforeEach(async function () {
                initAmount1 = new BN(1000).mul(baseNum);
                initAmount2 = new BN(1000).mul(baseNum);

                await mockController.mintGTokens(pwrd.address, initAmount1, { from: investor1 });
                await mockController.mintGTokens(pwrd.address, initAmount2, { from: investor2 });
            });

            it('Should ok when single investor', async function () {
                const amount = new BN(100).mul(baseNum);
                await mockController.burnGTokens(pwrd.address, amount, { from: investor1 });

                return expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                    initAmount1.add(initAmount2).sub(amount));
            });

            it('Should ok when multiply investors', async function () {
                const amount1 = new BN(100).mul(baseNum);
                await mockController.burnGTokens(
                    pwrd.address, amount1, { from: investor1 });
                const amount2 = new BN(200).mul(baseNum);
                await mockController.burnGTokens(
                    pwrd.address, amount2, { from: investor2 });

                await expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                    initAmount1.add(initAmount2).sub(amount1).sub(amount2));
                await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                    initAmount1.sub(amount1));
                return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                    initAmount2.sub(amount2));
            });

        });
    });

    describe('factor', function () {
        const BASE = new BN(10).pow(new BN(18));

        beforeEach(async function () {
            if (this.currentTest.title === 'Should be BASE value initially') return;

            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor1 });
        });

        it('Should be BASE value initially', function () {
            return expect(pwrd.factor()).to.eventually.be.a.bignumber.equal(BASE);
        });

        it('Should be zero when total assets dropped to zero', async function () {
            await mockController.setGTokenTotalAssets(0);

            return expect(pwrd.factor()).to.eventually.be.a.bignumber.equal(new BN(0));
        });

        it('Should be correct when total assets == total supply', async function () {
            return expect(pwrd.factor()).to.eventually.be.a.bignumber.equal(BASE);
        });

        it('Should be correct when total assets > total supply', async function () {
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
            return expect(pwrd.factor()).to.eventually.be.a.bignumber.equal(BASE.div(new BN(2)));
        });

        it('Should be correct when total assets < total supply', async function () {
            await mockController.setGTokenTotalAssets(new BN(100).mul(baseNum));
            return expect(pwrd.factor()).to.eventually.be.a.bignumber.equal(BASE.mul(new BN(2)));
        });
    });

    describe('totalSupply', function () {
        beforeEach(async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                pwrd.address, new BN(100).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            return expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(200).mul(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
            return expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(400).mul(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(100).mul(baseNum));
            return expect(pwrd.totalSupply()).to.eventually.be.a.bignumber.equal(
                new BN(100).mul(baseNum));
        });
    });

    describe('balanceOf', function () {
        beforeEach(async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            return expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(100).mul(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(600).mul(baseNum));
            return expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(200).mul(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum));
            return expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum));
        });
    });

    describe('transfer', function () {
        beforeEach(async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            await pwrd.transfer(
                investor2, new BN(50).mul(baseNum), { from: investor1 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await pwrd.transfer(
                investor2, new BN(250).mul(baseNum), { from: investor1 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(150).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(1050).mul(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum));
            await pwrd.transfer(
                investor2, new BN(40).mul(baseNum), { from: investor1 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(10).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(140).mul(baseNum));
        });

        it('Should revert when no enough amount', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            return expect(pwrd.transfer(investor2, new BN(450).mul(baseNum),
                { from: investor1 })).to.be.rejectedWith(
                    'ERC20: transfer amount exceeds balance');
        });
    });

    describe('transferFrom', function () {
        beforeEach(async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(100).mul(baseNum), { from: investor1 });

            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor2 });
        });

        it('Should be correct when totalAssets == totalSupplyBase', async function () {
            await pwrd.approve(
                investor3, new BN(50).mul(baseNum), { from: investor1 });
            await pwrd.transferFrom(
                investor1, investor2, new BN(50).mul(baseNum),
                { from: investor3 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(50).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(250).mul(baseNum));
        });

        it('Should be correct when total assets increase', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await pwrd.approve(
                investor3, new BN(250).mul(baseNum), { from: investor1 });
            await pwrd.transferFrom(
                investor1, investor2, new BN(250).mul(baseNum),
                { from: investor3 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(150).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(1050).mul(baseNum));
        });

        it('Should be correct when total assets decrease', async function () {
            await mockController.setGTokenTotalAssets(new BN(150).mul(baseNum));
            await pwrd.approve(
                investor3, new BN(40).mul(baseNum), { from: investor1 });
            await pwrd.transferFrom(
                investor1, investor2, new BN(40).mul(baseNum),
                { from: investor3 });
            await expect(pwrd.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(
                new BN(10).mul(baseNum));
            return expect(pwrd.balanceOf(investor2)).to.eventually.be.a.bignumber.equal(
                new BN(140).mul(baseNum));
        });

        it('Should revert when no enough amount', async function () {
            await mockController.setGTokenTotalAssets(new BN(1200).mul(baseNum));
            await pwrd.approve(
                investor3, new BN(450).mul(baseNum), { from: investor1 });
            return expect(pwrd.transferFrom(investor1, investor2, new BN(450).mul(baseNum),
                { from: investor3 })).to.be.rejectedWith(
                    'ERC20: transfer amount exceeds balance');
        });
    });

    describe('assets', function () {
        const BASE = new BN(10).pow(new BN(18));

        beforeEach(async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor1 });
            await mockController.setGTokenTotalAssets(new BN(400).mul(baseNum));
        });

        it('getPricePerShare', async function () {
            return expect(pwrd.getPricePerShare()).to.eventually.be.a.bignumber.equal(
                BASE);
        });

        it('getShareAssets', async function () {
            const shares = new BN(10).mul(baseNum)
            return expect(pwrd.getShareAssets(shares)).to.eventually.be.a.bignumber.equal(
                shares);
        });

        it('getAssets', async function () {
            const balance = await pwrd.balanceOf(investor1)
            return expect(pwrd.getAssets(investor1)).to.eventually.be.a.bignumber.equal(
                balance);
        });

    })

    describe('Rebasing event', function () {
        const BASE = new BN(10).pow(new BN(18));

        it('Burn event', async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(400).mul(baseNum), { from: investor1 }
            );
            const trx = await mockController.burnGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor1 }
            );
            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const firstBurn = await decodeLogs(tx.logs, RebasingGToken, pwrd.address, 'Transfer');

            assert.strictEqual(firstBurn[0].args.value, '200000000000000000000');

            await mockController.increaseGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await pwrd.balanceOf(investor1);

            const burnAmount = new BN(100).mul(baseNum)
            const factor = await pwrd.factor();
            const expectedFinal = initAmount.sub(burnAmount);
            const trx2 = await mockController.burnGTokens(
                pwrd.address, burnAmount, { from: investor1 }
            );
            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            await decodeLogs(tx2.logs, RebasingGToken, pwrd.address, 'Transfer');
            const secondBurn = await decodeLogs(tx2.logs, RebasingGToken, pwrd.address, 'Transfer');

            await expect(pwrd.balanceOf(investor1)).
                to.eventually.be.a.bignumber.equal(expectedFinal);
            return assert.strictEqual(secondBurn[0].args.value, burnAmount.toString());
        });

        it('Mint event', async function () {
            const trx = await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor1 }
            );
            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const firstMint = await decodeLogs(tx.logs, RebasingGToken, pwrd.address, 'Transfer');

            assert.strictEqual(firstMint[0].args.value, '200000000000000000000');
            // change factor
            await mockController.setGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await pwrd.balanceOf(investor1);

            //second burn with new factor
            const mintAmount = new BN(100).mul(baseNum)
            const factor = await pwrd.factor();
            const expectedFinal = initAmount.add(mintAmount);
            const trx2 = await mockController.mintGTokens(
                pwrd.address, mintAmount, { from: investor1 }
            );
            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            const secondMint = await decodeLogs(tx2.logs, RebasingGToken, pwrd.address, 'Transfer');

            await expect(pwrd.balanceOf(investor1)).
                to.eventually.be.a.bignumber.equal(expectedFinal);
            return assert.strictEqual(secondMint[0].args.value, mintAmount.toString());
        });

        it('Transfer event', async function () {
            await mockController.mintGTokens(
                pwrd.address, new BN(200).mul(baseNum), { from: investor1 }
            );

            // change factor
            await mockController.setGTokenTotalAssets(new BN(500).mul(baseNum));
            const initAmount = await pwrd.balanceOf(investor1);

            await expect(pwrd.factor()).
                to.eventually.be.a.bignumber.below(new BN(1).mul(baseNum));
            //transfer with new factor
            const trx = await pwrd.transfer(
                investor2, '1000000', { from: investor1 }
            );

            const tx = await web3.eth.getTransactionReceipt(trx.tx)
            const transfer = await decodeLogs(tx.logs, RebasingGToken, pwrd.address, 'Transfer');

            assert.strictEqual(transfer[0].args.value, '1000000');

            // transfer from
            const approvalAmount = new BN('1000000000');
            const transferAmount = new BN('1000000')
            await pwrd.approve(
                investor2, approvalAmount, { from: investor1 }
            );
            const trx2 = await pwrd.transferFrom(
                investor1, investor2, transferAmount, { from: investor2 }
            );

            const tx2 = await web3.eth.getTransactionReceipt(trx2.tx)
            const transferFrom = await decodeLogs(tx2.logs, RebasingGToken, pwrd.address, 'Transfer');

            await expect(pwrd.allowance(investor1, investor2)).
                to.eventually.be.a.bignumber.equal(approvalAmount.sub(transferAmount));
            return assert.strictEqual(transferFrom[0].args.value, transferAmount.toString());
        })
    })
});
