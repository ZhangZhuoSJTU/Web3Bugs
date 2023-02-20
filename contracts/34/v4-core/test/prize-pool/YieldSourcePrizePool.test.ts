import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants, Contract, ContractFactory, utils } from 'ethers';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { artifacts, ethers } from 'hardhat';

const { AddressZero } = constants;
const { getContractFactory, getSigners } = ethers;
const { parseEther: toWei } = utils;

const debug = require('debug')('ptv3:YieldSourcePrizePool.test');

describe('YieldSourcePrizePool', function () {
    let wallet: SignerWithAddress;
    let wallet2: SignerWithAddress;

    let prizePool: Contract;
    let depositToken: Contract;
    let yieldSource: MockContract;
    let ticket: Contract;
    let YieldSourcePrizePool: ContractFactory;

    let isConstructorTest = false;

    const deployYieldSourcePrizePool = async (yieldSourceAddress: string = yieldSource.address) => {
        YieldSourcePrizePool = await getContractFactory('YieldSourcePrizePool', wallet);
        prizePool = await YieldSourcePrizePool.deploy(wallet.address, yieldSourceAddress);

        const Ticket = await getContractFactory('Ticket');
        ticket = await Ticket.deploy('name', 'SYMBOL', 18, prizePool.address);

        await prizePool.setPrizeStrategy(wallet2.address);
        await prizePool.setTicket(ticket.address);
    };

    const depositTo = async (amount: BigNumber) => {
        await yieldSource.mock.supplyTokenTo.withArgs(amount, prizePool.address).returns();

        await depositToken.approve(prizePool.address, amount);
        await depositToken.mint(wallet.address, amount);
        await prizePool.depositTo(wallet.address, amount);
    };

    beforeEach(async () => {
        [wallet, wallet2] = await getSigners();
        debug(`using wallet ${wallet.address}`);

        debug('creating token...');
        const ERC20MintableContract = await getContractFactory('ERC20Mintable', wallet);
        depositToken = await ERC20MintableContract.deploy('Token', 'TOKE');

        debug('creating yield source mock...');
        const IYieldSource = await artifacts.readArtifact('IYieldSource');
        yieldSource = await deployMockContract(wallet as Signer, IYieldSource.abi);
        await yieldSource.mock.depositToken.returns(depositToken.address);

        if (!isConstructorTest) {
            await deployYieldSourcePrizePool();
        }
    });

    describe('constructor()', () => {
        before(() => {
            isConstructorTest = true;
        });

        after(() => {
            isConstructorTest = false;
        });

        it('should deploy correctly', async () => {
            await deployYieldSourcePrizePool();

            await expect(prizePool.deployTransaction)
                .to.emit(prizePool, 'Deployed')
                .withArgs(yieldSource.address);

            expect(await prizePool.yieldSource()).to.equal(yieldSource.address);
        });

        it('should require the yield source', async () => {
            await expect(
                YieldSourcePrizePool.deploy(wallet.address, AddressZero),
            ).to.be.revertedWith('YieldSourcePrizePool/yield-source-not-zero-address');
        });

        it('should require a valid yield source', async () => {
            await expect(
                YieldSourcePrizePool.deploy(wallet.address, prizePool.address),
            ).to.be.revertedWith('YieldSourcePrizePool/invalid-yield-source');
        });
    });

    describe('supply()', async () => {
        it('should supply assets to the yield source', async () => {
            const amount = toWei('10');

            await depositTo(amount);

            expect(await ticket.balanceOf(wallet.address)).to.equal(amount);
        });
    });

    describe('balance()', async () => {
        it('should return the total underlying balance of asset tokens', async () => {
            const amount = toWei('10');

            await depositTo(amount);

            await yieldSource.mock.balanceOfToken.withArgs(prizePool.address).returns(amount);

            expect(await prizePool.callStatic.balance()).to.equal(amount);
        });
    });

    describe('redeem()', async () => {
        it('should redeem assets from the yield source', async () => {
            const amount = toWei('99');

            await depositToken.approve(prizePool.address, amount);
            await depositToken.mint(wallet.address, amount);
            await yieldSource.mock.supplyTokenTo.withArgs(amount, prizePool.address).returns();
            await prizePool.depositTo(wallet.address, amount);

            await yieldSource.mock.redeemToken.withArgs(amount).returns(amount);
            await prizePool.withdrawFrom(wallet.address, amount);

            expect(await ticket.balanceOf(wallet.address)).to.equal('0');
            expect(await depositToken.balanceOf(wallet.address)).to.equal(amount);
        });
    });

    describe('token()', async () => {
        it('should return the yield source token', async () => {
            expect(await prizePool.getToken()).to.equal(depositToken.address);
        });
    });

    describe('canAwardExternal()', async () => {
        it('should not allow the prize pool to award its token, as its likely the receipt', async () => {
            expect(await prizePool.canAwardExternal(yieldSource.address)).to.equal(false);
        });
    });
});
