import { Signer } from '@ethersproject/abstract-signer';
import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { artifacts, ethers } from 'hardhat';

const { constants, getContractFactory, getSigners, utils } = ethers;
const { AddressZero } = constants;
const { parseEther: toWei } = utils;

let isConstructorTest = false;

describe('ControlledToken', () => {
    let wallet: SignerWithAddress;
    let wallet2: SignerWithAddress;

    let controller: MockContract;

    // Conflict between types for `call` and `deploy`, so we use `any`
    let token: any;

    const deployToken = async (controllerAddres = controller.address, decimals = 18) => {
        const ControlledToken = await getContractFactory('ControlledToken', wallet);
        token = await ControlledToken.deploy('Name', 'Symbol', decimals, controllerAddres);
    };

    beforeEach(async () => {
        [wallet, wallet2] = await getSigners();

        const PrizePool = await artifacts.readArtifact('PrizePool');
        controller = await deployMockContract(wallet as Signer, PrizePool.abi);

        if (!isConstructorTest) {
            await deployToken();
        }
    });

    describe('constructor()', () => {
        beforeEach(async () => {
            isConstructorTest = true;
            await deployToken();
        });

        after(async () => {
            isConstructorTest = false;
        });

        it('should fail to deploy token if controller is address zero', async () => {
            await expect(deployToken(AddressZero)).to.be.revertedWith(
                'ControlledToken/controller-not-zero-address',
            );
        });

        it('should fail to deploy token if decimals is zero', async () => {
            await expect(deployToken(controller.address, 0)).to.be.revertedWith(
                'ControlledToken/decimals-gt-zero',
            );
        });
    });

    describe('controllerMint()', () => {
        it('should allow the controller to mint tokens', async () => {
            const amount = toWei('10');

            await controller.call(token, 'controllerMint', wallet.address, amount);

            expect(await token.balanceOf(wallet.address)).to.equal(amount);
        });

        it('should only be callable by the controller', async () => {
            const amount = toWei('10');

            await expect(token.controllerMint(wallet.address, amount)).to.be.revertedWith(
                'ControlledToken/only-controller',
            );
        });
    });

    describe('controllerBurn()', () => {
        it('should allow the controller to burn tokens', async () => {
            const amount = toWei('10');

            await controller.call(token, 'controllerMint', wallet.address, amount);
            expect(await token.balanceOf(wallet.address)).to.equal(amount);

            await controller.call(token, 'controllerBurn', wallet.address, amount);
            expect(await token.balanceOf(wallet.address)).to.equal('0');
        });

        it('should only be callable by the controller', async () => {
            const amount = toWei('10');

            await expect(token.controllerBurn(wallet.address, amount)).to.be.revertedWith(
                'ControlledToken/only-controller',
            );
        });
    });

    describe('controllerBurnFrom()', () => {
        it('should allow the controller to burn for someone', async () => {
            const amount = toWei('10');

            await controller.call(token, 'controllerMint', wallet.address, amount);
            await token.approve(wallet2.address, amount);

            await controller.call(
                token,
                'controllerBurnFrom',
                wallet2.address,
                wallet.address,
                amount,
            );

            expect(await token.balanceOf(wallet.address)).to.equal('0');
            expect(await token.allowance(wallet.address, wallet2.address)).to.equal('0');
        });

        it('should not allow non-approved users to burn', async () => {
            const amount = toWei('10');

            await controller.call(token, 'controllerMint', wallet.address, amount);

            await expect(
                controller.call(
                    token,
                    'controllerBurnFrom',
                    wallet2.address,
                    wallet.address,
                    amount,
                ),
            ).to.be.revertedWith('');
        });

        it('should allow a user to burn their own', async () => {
            const amount = toWei('10');

            await controller.call(token, 'controllerMint', wallet.address, amount);

            await controller.call(
                token,
                'controllerBurnFrom',
                wallet.address,
                wallet.address,
                amount,
            );

            expect(await token.balanceOf(wallet.address)).to.equal('0');
        });

        it('should only be callable by the controller', async () => {
            const amount = toWei('10');

            await expect(
                token.controllerBurnFrom(wallet2.address, wallet.address, amount),
            ).to.be.revertedWith('ControlledToken/only-controller');
        });
    });

    describe('decimals()', () => {
        it('should return the number of decimals', async () => {
            expect(await token.decimals()).to.equal(18);
        });
    });
});
