import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { BigNumber, constants, Contract, ContractFactory, utils } from 'ethers';
import { ethers, artifacts } from 'hardhat';
import { Artifact } from 'hardhat/types';

import { call } from '../helpers/call';

const { AddressZero, MaxUint256 } = constants;
const { getContractFactory, getSigners, Wallet } = ethers;
const { parseEther: toWei } = utils;

const debug = require('debug')('ptv3:PrizePool.test');
let NFT_TOKEN_ID = 1;

describe('PrizePool', function () {
    let wallet1: SignerWithAddress;
    let wallet2: SignerWithAddress;
    let prizeStrategyManager: SignerWithAddress;
    let wallet4: SignerWithAddress;
    let wallet5: SignerWithAddress;
    let ICompLike: Artifact;
    let ERC20MintableContract: ContractFactory;
    let ERC721MintableContract: ContractFactory;
    let PrizePoolHarness: ContractFactory;
    let Ticket: ContractFactory;
    let IERC721: Artifact;
    let YieldSourceStub: Artifact;

    // Set as `any` cause types are conflicting between the different path for ethers
    let prizePool: any;
    let prizePool2: any;
    let depositToken: Contract;
    let erc20Token: Contract;
    let erc721Token: Contract;
    let ticket: Contract;
    let compLike: MockContract;
    let erc721tokenMock: MockContract;
    let yieldSourceStub: MockContract;

    const depositTokenIntoPrizePool = async (
        recipientAddress: string,
        amount: BigNumber,
        token: Contract = depositToken,
        operator: SignerWithAddress = wallet1,
    ) => {
        await yieldSourceStub.mock.supplyTokenTo.withArgs(amount, prizePool.address).returns();

        await token.connect(operator).approve(prizePool.address, amount);
        await token.connect(operator).mint(operator.address, amount);

        if (token.address === depositToken.address) {
            return await prizePool.connect(operator).depositTo(recipientAddress, amount);
        } else {
            return await token.connect(operator).transfer(prizePool.address, amount);
        }
    };

    const depositNftIntoPrizePool = async (walletAddress: string) => {
        await erc721Token.mint(walletAddress, NFT_TOKEN_ID);
        await erc721Token.transferFrom(walletAddress, prizePool.address, NFT_TOKEN_ID);
    };

    before(async () => {
        [wallet1, wallet2, prizeStrategyManager, wallet4, wallet5] = await getSigners();
        debug(`using wallet ${wallet1.address}`);
        ERC20MintableContract = await getContractFactory('ERC20Mintable', wallet1);
        ICompLike = await artifacts.readArtifact('ICompLike');
        ERC721MintableContract = await getContractFactory('ERC721Mintable', wallet1);
        PrizePoolHarness = await getContractFactory('PrizePoolHarness', wallet1);
        Ticket = await getContractFactory('Ticket');
        IERC721 = await artifacts.readArtifact('IERC721');
        YieldSourceStub = await artifacts.readArtifact('YieldSourceStub');
        compLike = await deployMockContract(wallet1 as Signer, ICompLike.abi);
    });

    beforeEach(async () => {
        debug('mocking tokens...');
        depositToken = await ERC20MintableContract.deploy('Token', 'TOKE');
        erc20Token = await ERC20MintableContract.deploy('Token', 'TOKE');
        erc721Token = await ERC721MintableContract.deploy();
        erc721tokenMock = await deployMockContract(wallet1 as Signer, IERC721.abi);
        yieldSourceStub = await deployMockContract(wallet1 as Signer, YieldSourceStub.abi);
        await yieldSourceStub.mock.depositToken.returns(depositToken.address);
        prizePool = await PrizePoolHarness.deploy(wallet1.address, yieldSourceStub.address);
        ticket = await Ticket.deploy('Ticket', 'TICK', 18, prizePool.address);

        await prizePool.setTicket(ticket.address);
        await prizePool.setPrizeStrategy(prizeStrategyManager.address);
    });

    /*============================================ */
    // Constructor Functions ---------------------
    /*============================================ */
    describe('constructor()', () => {
        beforeEach(async () => {
            prizePool = await PrizePoolHarness.deploy(wallet1.address, yieldSourceStub.address);
            ticket = await Ticket.deploy('Ticket', 'TICK', 18, prizePool.address);
        });
        it('should fire the events', async () => {
            const deployTx = prizePool.deployTransaction;

            await expect(deployTx).to.emit(prizePool, 'LiquidityCapSet').withArgs(MaxUint256);

            await expect(prizePool.setPrizeStrategy(prizeStrategyManager.address))
                .to.emit(prizePool, 'PrizeStrategySet')
                .withArgs(prizeStrategyManager.address);

            const setTicketTx = await prizePool.setTicket(ticket.address);

            await expect(setTicketTx).to.emit(prizePool, 'TicketSet').withArgs(ticket.address);

            await expect(setTicketTx).to.emit(prizePool, 'BalanceCapSet').withArgs(MaxUint256);
        });

        it('should set all the vars', async () => {
            expect(await prizePool.getToken()).to.equal(depositToken.address);
        });

        it('should reject invalid params', async () => {
            const PrizePoolHarness = await getContractFactory('PrizePoolHarness', wallet1);
            prizePool2 = await PrizePoolHarness.deploy(wallet1.address, yieldSourceStub.address);

            await expect(prizePool2.setTicket(AddressZero)).to.be.revertedWith(
                'PrizePool/ticket-not-zero-address',
            );
        });
    });

    /*============================================ */
    // Core Functions ----------------------------
    /*============================================ */
    describe('Core Functions', () => {
        describe('award()', () => {
            it('should return early if amount is 0', async () => {
                await prizePool.setPrizeStrategy(wallet1.address);

                await expect(prizePool.award(wallet2.address, toWei('0'))).to.not.emit(
                    prizePool,
                    'Awarded',
                );
            });

            it('should fail if amount is GREATER THEN the current award balance', async () => {
                await prizePool.setPrizeStrategy(wallet1.address);
                await prizePool.setCurrentAwardBalance(toWei('1000'));

                await expect(prizePool.award(wallet2.address, toWei('2000'))).to.be.revertedWith(
                    'PrizePool/award-exceeds-avail',
                );
            });
            it('should succeed to award tickets and emit Awarded', async () => {
                await prizePool.setPrizeStrategy(wallet1.address);
                await prizePool.setCurrentAwardBalance(toWei('2000'));

                await expect(prizePool.award(wallet2.address, toWei('1000')))
                    .to.emit(prizePool, 'Awarded')
                    .withArgs(wallet2.address, ticket.address, toWei('1000'));
            });
        });

        describe('depositToAndDelegate()', () => {
            it('should delegate after depositing', async () => {
                const amount = toWei('100');
                await depositToken.approve(prizePool.address, amount);
                await depositToken.mint(wallet1.address, amount);

                await yieldSourceStub.mock.supplyTokenTo
                    .withArgs(amount, prizePool.address)
                    .returns();

                await prizePool.depositToAndDelegate(wallet1.address, amount, wallet2.address);

                expect(await ticket.delegateOf(wallet1.address)).to.equal(wallet2.address);
            });
        });

        describe('depositTo()', () => {
            it('should revert when deposit exceeds liquidity cap', async () => {
                const amount = toWei('1');
                const liquidityCap = toWei('1000');

                await depositTokenIntoPrizePool(wallet1.address, liquidityCap);

                await prizePool.setLiquidityCap(liquidityCap);

                await expect(prizePool.depositTo(wallet2.address, amount)).to.be.revertedWith(
                    'PrizePool/exceeds-liquidity-cap',
                );
            });

            it('should revert when user deposit exceeds ticket balance cap', async () => {
                const amount = toWei('1');
                const balanceCap = toWei('50000');

                await prizePool.setBalanceCap(balanceCap);
                await depositTokenIntoPrizePool(wallet1.address, balanceCap);

                await expect(depositTokenIntoPrizePool(wallet1.address, amount)).to.be.revertedWith(
                    'PrizePool/exceeds-balance-cap',
                );
            });

            it('should revert when user deposit for another wallet exceeds ticket balance cap', async () => {
                const amount = toWei('1');
                const balanceCap = toWei('50000');

                await prizePool.setBalanceCap(balanceCap);
                await depositTokenIntoPrizePool(wallet2.address, balanceCap);

                await expect(depositTokenIntoPrizePool(wallet2.address, amount)).to.be.revertedWith(
                    'PrizePool/exceeds-balance-cap',
                );
            });
        });

        describe('captureAwardBalance()', () => {
            it('should handle when the balance is less than the collateral', async () => {
                await depositTokenIntoPrizePool(wallet1.address, toWei('100'));

                await yieldSourceStub.mock.balanceOfToken
                    .withArgs(prizePool.address)
                    .returns(toWei('99.9999'));

                expect(await prizePool.awardBalance()).to.equal(toWei('0'));
            });

            it('should handle the situ when the total accrued interest is less than the captured total', async () => {
                await depositTokenIntoPrizePool(wallet1.address, toWei('100'));

                await yieldSourceStub.mock.balanceOfToken
                    .withArgs(prizePool.address)
                    .returns(toWei('110'));

                // first capture the 10 tokens
                await prizePool.captureAwardBalance();

                await yieldSourceStub.mock.balanceOfToken
                    .withArgs(prizePool.address)
                    .returns(toWei('109.999'));

                // now try to capture again
                await expect(prizePool.captureAwardBalance()).to.not.emit(
                    prizePool,
                    'AwardCaptured',
                );
            });

            it('should track the yield less the total token supply', async () => {
                await depositTokenIntoPrizePool(wallet1.address, toWei('100'));

                await yieldSourceStub.mock.balanceOfToken
                    .withArgs(prizePool.address)
                    .returns(toWei('110'));

                await expect(prizePool.captureAwardBalance())
                    .to.emit(prizePool, 'AwardCaptured')
                    .withArgs(toWei('10'));

                expect(await prizePool.awardBalance()).to.equal(toWei('10'));
            });
        });

        describe('withdrawFrom()', () => {
            it('should allow a user to withdraw instantly', async () => {
                let amount = toWei('10');

                await depositTokenIntoPrizePool(wallet1.address, amount);

                await yieldSourceStub.mock.redeemToken.withArgs(amount).returns(amount);

                await expect(prizePool.withdrawFrom(wallet1.address, amount))
                    .to.emit(prizePool, 'Withdrawal')
                    .withArgs(wallet1.address, wallet1.address, ticket.address, amount, amount);
            });
        });
    });

    /*============================================ */
    // Getter Functions --------------------------
    /*============================================ */
    describe('Getter Functions', () => {
        it('should getAccountedBalance()', async () => {
            expect(await prizePool.getAccountedBalance()).to.equal(0);
        });
        it('should getBalanceCap()', async () => {
            expect(await prizePool.getBalanceCap()).to.equal(constants.MaxUint256);
        });
        it('should getLiquidityCap()', async () => {
            expect(await prizePool.getLiquidityCap()).to.equal(constants.MaxUint256);
        });
        it('should getTicket()', async () => {
            expect(await prizePool.getTicket()).to.equal(ticket.address);
        });
        it('should getPrizeStrategy()', async () => {
            expect(await prizePool.getPrizeStrategy()).to.equal(prizeStrategyManager.address);
        });
        it('should canAwardExternal()', async () => {
            await yieldSourceStub.mock.canAwardExternal.withArgs(erc20Token.address).returns(false);
            expect(await prizePool.canAwardExternal(erc20Token.address)).to.equal(false);

            await yieldSourceStub.mock.canAwardExternal.withArgs(ticket.address).returns(true);
            expect(await prizePool.canAwardExternal(ticket.address)).to.equal(true);
        });

        describe('balance()', () => {
            it('should return zero if no deposits have been made', async () => {
                const balance = toWei('11');
                await yieldSourceStub.mock.balanceOfToken
                    .withArgs(prizePool.address)
                    .returns(balance);

                expect((await call(prizePool, 'balance')).toString()).to.equal(balance);
            });
        });

        describe('compLikeDelegate()', () => {
            it('should fail to delegate tokens', async () => {
                await compLike.mock.balanceOf.withArgs(prizePool.address).returns(0);

                expect(await prizePool.compLikeDelegate(compLike.address, wallet4.address));
            });

            it('should succeed to delegate tokens', async () => {
                await compLike.mock.balanceOf.withArgs(prizePool.address).returns(100);
                await compLike.mock.delegate.withArgs(wallet4.address).returns();

                expect(await prizePool.compLikeDelegate(compLike.address, wallet4.address));
            });
        });

        describe('isControlled()', () => {
            it('should validate TRUE with ticket variable', async () => {
                expect(await prizePool.isControlled(await prizePool.getTicket())).to.equal(true);
            });

            it('should validate FALSE with non-ticket variable', async () => {
                expect(await prizePool.isControlled(AddressZero)).to.equal(false);
            });
        });
    });

    /*============================================ */
    // Setter Functions --------------------------
    /*============================================ */
    describe('Setter Functions', () => {
        beforeEach(async () => {
            prizePool = await PrizePoolHarness.deploy(wallet1.address, yieldSourceStub.address);
            ticket = await Ticket.deploy('Ticket', 'TICK', 18, prizePool.address);
        });

        describe('setTicket()', () => {
            it('should allow the owner to swap the prize strategy', async () => {
                await expect(prizePool.setTicket(wallet4.address))
                    .to.emit(prizePool, 'TicketSet')
                    .withArgs(wallet4.address);

                expect(await prizePool.getTicket()).to.equal(wallet4.address);
            });

            it('should not allow anyone else to change the prize strategy', async () => {
                await expect(
                    prizePool.connect(wallet2 as Signer).setTicket(wallet4.address),
                ).to.be.revertedWith('Ownable/caller-not-owner');
            });
        });

        describe('setPrizeStrategy()', () => {
            it('should allow the owner to swap the prize strategy', async () => {
                const randomWallet = Wallet.createRandom();

                await expect(prizePool.setPrizeStrategy(randomWallet.address))
                    .to.emit(prizePool, 'PrizeStrategySet')
                    .withArgs(randomWallet.address);

                expect(await prizePool.getPrizeStrategy()).to.equal(randomWallet.address);
            });

            it('should not allow anyone else to change the prize strategy', async () => {
                await expect(
                    prizePool.connect(wallet2 as Signer).setPrizeStrategy(wallet2.address),
                ).to.be.revertedWith('Ownable/caller-not-owner');
            });
        });

        describe('setBalanceCap', () => {
            it('should allow the owner to set the balance cap', async () => {
                const balanceCap = toWei('50000');

                await expect(prizePool.setBalanceCap(balanceCap))
                    .to.emit(prizePool, 'BalanceCapSet')
                    .withArgs(balanceCap);

                expect(await prizePool.getBalanceCap()).to.equal(balanceCap);
            });

            it('should not allow anyone else to call', async () => {
                prizePool2 = prizePool.connect(wallet2 as Signer);

                await expect(prizePool2.setBalanceCap(toWei('50000'))).to.be.revertedWith(
                    'Ownable/caller-not-owner',
                );
            });
        });

        describe('setLiquidityCap', () => {
            it('should allow the owner to set the liquidity cap', async () => {
                const liquidityCap = toWei('1000');

                await expect(prizePool.setLiquidityCap(liquidityCap))
                    .to.emit(prizePool, 'LiquidityCapSet')
                    .withArgs(liquidityCap);

                expect(await prizePool.getLiquidityCap()).to.equal(liquidityCap);
            });

            it('should not allow anyone else to call', async () => {
                prizePool2 = prizePool.connect(wallet2 as Signer);

                await expect(prizePool2.setLiquidityCap(toWei('1000'))).to.be.revertedWith(
                    'Ownable/caller-not-owner',
                );
            });
        });
    });

    /*============================================ */
    // Token Functions ---------------------------
    /*============================================ */
    describe('Token Functions', () => {
        describe('awardExternalERC20()', () => {
            beforeEach(async () => {
                await prizePool.setPrizeStrategy(prizeStrategyManager.address);
            });

            it('should exit early when amount = 0', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC20(wallet1.address, erc20Token.address, 0),
                ).to.not.emit(prizePool, 'AwardedExternalERC20');
            });

            it('should only allow the prizeStrategy to award external ERC20s', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                let prizePool2 = prizePool.connect(wallet2 as Signer);

                await expect(
                    prizePool2.awardExternalERC20(wallet1.address, wallet2.address, toWei('10')),
                ).to.be.revertedWith('PrizePool/only-prizeStrategy');
            });

            it('should allow arbitrary tokens to be transferred', async () => {
                const amount = toWei('10');

                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                await depositTokenIntoPrizePool(wallet1.address, amount, erc20Token);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC20(wallet1.address, erc20Token.address, amount),
                )
                    .to.emit(prizePool, 'AwardedExternalERC20')
                    .withArgs(wallet1.address, erc20Token.address, amount);
            });
        });

        describe('transferExternalERC20()', () => {
            beforeEach(async () => {
                await prizePool.setPrizeStrategy(prizeStrategyManager.address);
            });

            it('should exit early when amount = 0', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .transferExternalERC20(wallet1.address, erc20Token.address, 0),
                ).to.not.emit(prizePool, 'TransferredExternalERC20');
            });

            it('should only allow the prizeStrategy to award external ERC20s', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                let prizePool2 = prizePool.connect(wallet2 as Signer);

                await expect(
                    prizePool2.transferExternalERC20(wallet1.address, wallet2.address, toWei('10')),
                ).to.be.revertedWith('PrizePool/only-prizeStrategy');
            });

            it('should allow arbitrary tokens to be transferred', async () => {
                const amount = toWei('10');

                await depositTokenIntoPrizePool(wallet1.address, amount, erc20Token);

                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc20Token.address)
                    .returns(true);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .transferExternalERC20(wallet1.address, erc20Token.address, amount),
                )
                    .to.emit(prizePool, 'TransferredExternalERC20')
                    .withArgs(wallet1.address, erc20Token.address, amount);
            });
        });

        describe('awardExternalERC721()', () => {
            beforeEach(async () => {
                await prizePool.setPrizeStrategy(prizeStrategyManager.address);
            });

            it('should exit early when tokenIds list is empty', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc721Token.address)
                    .returns(true);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC721(wallet1.address, erc721Token.address, []),
                ).to.not.emit(prizePool, 'AwardedExternalERC721');
            });

            it('should only allow the prizeStrategy to award external ERC721s', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc721Token.address)
                    .returns(true);

                let prizePool2 = prizePool.connect(wallet2 as Signer);

                await expect(
                    prizePool2.awardExternalERC721(wallet1.address, erc721Token.address, [
                        NFT_TOKEN_ID,
                    ]),
                ).to.be.revertedWith('PrizePool/only-prizeStrategy');
            });

            it('should allow arbitrary tokens to be transferred', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc721Token.address)
                    .returns(true);

                await depositNftIntoPrizePool(wallet1.address);

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC721(wallet1.address, erc721Token.address, [NFT_TOKEN_ID]),
                )
                    .to.emit(prizePool, 'AwardedExternalERC721')
                    .withArgs(wallet1.address, erc721Token.address, [NFT_TOKEN_ID]);
            });

            it('should not DoS with faulty ERC721s', async () => {
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc721tokenMock.address)
                    .returns(true);

                await erc721tokenMock.mock['safeTransferFrom(address,address,uint256)']
                    .withArgs(prizePool.address, wallet1.address, NFT_TOKEN_ID)
                    .reverts();

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC721(wallet1.address, erc721tokenMock.address, [
                            NFT_TOKEN_ID,
                        ]),
                ).to.emit(prizePool, 'ErrorAwardingExternalERC721');
            });

            it('should not emit faulty tokenIds', async () => {
                // add faulty tokenId
                await yieldSourceStub.mock.canAwardExternal
                    .withArgs(erc721tokenMock.address)
                    .returns(true);

                await erc721tokenMock.mock['safeTransferFrom(address,address,uint256)']
                    .withArgs(prizePool.address, wallet1.address, 1)
                    .reverts();

                // add non-faulty tokenId
                await erc721tokenMock.mock['safeTransferFrom(address,address,uint256)']
                    .withArgs(prizePool.address, wallet1.address, 2)
                    .returns();

                await expect(
                    prizePool
                        .connect(prizeStrategyManager)
                        .awardExternalERC721(wallet1.address, erc721tokenMock.address, [1, 2]),
                )
                    .to.emit(prizePool, 'AwardedExternalERC721')
                    .withArgs(wallet1.address, erc721tokenMock.address, [0, 2]);
            });
        });

        describe('onERC721Received()', () => {
            it('should return the interface selector', async () => {
                expect(
                    await prizePool.onERC721Received(
                        prizePool.address,
                        constants.AddressZero,
                        0,
                        '0x150b7a02',
                    ),
                ).to.equal('0x150b7a02');
            });

            it('should receive an ERC721 token when using safeTransferFrom', async () => {
                expect(await erc721Token.balanceOf(prizePool.address)).to.equal('0');
                await depositNftIntoPrizePool(wallet1.address);
                expect(await erc721Token.balanceOf(prizePool.address)).to.equal('1');
            });
        });
    });

    /*============================================ */
    // Internal Functions ------------------------
    /*============================================ */
    describe('Internal Functions', () => {
        it('should get the current block.timestamp', async () => {
            const timenow = (await ethers.provider.getBlock('latest')).timestamp;
            expect(await prizePool.internalCurrentTime()).to.equal(timenow);
        });
    });
});
