import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { utils, Contract } from 'ethers';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import hre, { ethers } from 'hardhat';

import { signPermit } from '../helpers/signPermit';

const { getContractFactory, getSigners, provider } = ethers;
const { artifacts } = hre;
const { getNetwork } = provider;
const { parseEther: toWei, splitSignature } = utils;

describe('EIP2612PermitAndDeposit', () => {
    let wallet: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let wallet3: SignerWithAddress;

    let permitAndDeposit: Contract;
    let usdc: Contract;
    let prizePool: MockContract;

    let chainId: number;

    type EIP2612PermitAndDepositTo = {
        prizePool: string;
        fromWallet?: SignerWithAddress;
        to: string;
        amount: string;
    };

    async function permitAndDepositTo({
        prizePool,
        fromWallet,
        to,
        amount,
    }: EIP2612PermitAndDepositTo) {
        if (!fromWallet) {
            fromWallet = wallet;
        }

        const deadline = new Date().getTime();

        let permit = await signPermit(
            wallet,
            {
                name: 'USD Coin',
                version: '1',
                chainId,
                verifyingContract: usdc.address,
            },
            {
                owner: wallet.address,
                spender: permitAndDeposit.address,
                value: amount,
                nonce: 0,
                deadline,
            },
        );

        let { v, r, s } = splitSignature(permit.sig);

        return permitAndDeposit
            .connect(fromWallet)
            .permitAndDepositTo(
                usdc.address,
                wallet.address,
                amount,
                deadline,
                v,
                r,
                s,
                prizePool,
                to,
            );
    }

    beforeEach(async () => {
        [wallet, wallet2, wallet3] = await getSigners();

        const network = await getNetwork();
        chainId = network.chainId;

        const Usdc = await getContractFactory('EIP2612PermitMintable');
        usdc = await Usdc.deploy('USD Coin', 'USDC');

        const IPrizePool = await artifacts.readArtifact('IPrizePool');
        prizePool = await deployMockContract(wallet as Signer, IPrizePool.abi);

        const EIP2612PermitAndDeposit = await getContractFactory('EIP2612PermitAndDeposit');

        permitAndDeposit = await EIP2612PermitAndDeposit.deploy();
    });

    describe('permitAndDepositTo()', () => {
        it('should work', async () => {
            await usdc.mint(wallet.address, toWei('1000'));

            await prizePool.mock.depositTo.withArgs(wallet2.address, toWei('100')).returns();

            await permitAndDepositTo({
                prizePool: prizePool.address,
                to: wallet2.address,
                amount: '100000000000000000000',
            });

            expect(await usdc.allowance(permitAndDeposit.address, prizePool.address)).to.equal(
                toWei('100'),
            );

            expect(await usdc.balanceOf(permitAndDeposit.address)).to.equal(toWei('100'));
            expect(await usdc.balanceOf(wallet.address)).to.equal(toWei('900'));
        });

        it('should not allow anyone else to use the signature', async () => {
            await usdc.mint(wallet.address, toWei('1000'));

            await prizePool.mock.depositTo.withArgs(wallet2.address, toWei('100')).returns();

            await expect(
                permitAndDepositTo({
                    prizePool: prizePool.address,
                    to: wallet2.address,
                    fromWallet: wallet2,
                    amount: '100000000000000000000',
                }),
            ).to.be.revertedWith('EIP2612PermitAndDeposit/only-signer');
        });
    });
});
