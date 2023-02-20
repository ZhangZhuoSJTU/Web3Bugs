const chai = require('chai');
const { solidity } = require('ethereum-waffle');
const { ethers } = require('hardhat');
const { BigNumber, utils } = require('ethers');
const { parseEther } = require('ethers/lib/utils');
const { MAXIMUM_U256, mineBlocks } = require('../helpers/utils');

chai.use(solidity);

const { expect } = chai;

let AlchemistFactory;
let TransmuterFactory;
let ERC20MockFactory;
let AlUSDFactory;
let VaultAdapterMockFactory;

describe('Transmuter', () => {
    let deployer;
    let depositor;
    let alchemist;
    let governance;
    let minter;
    let rewards;
    let sentinel;
    let user;
    let mockAlchemist;
    let token;
    let transmuter;
    let adapter;
    let alUsd;
    let harvestFee = 1000;
    let ceilingAmt = utils.parseEther('10000000');
    let collateralizationLimit = '2000000000000000000';
    let mockAlchemistAddress;
    let preTestTotalAlUSDSupply;

    before(async () => {
        TransmuterFactory = await ethers.getContractFactory('Transmuter');
        ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
        AlUSDFactory = await ethers.getContractFactory('AlToken');
        AlchemistFactory = await ethers.getContractFactory('Alchemist');
        VaultAdapterMockFactory = await ethers.getContractFactory('VaultAdapterMock');
    });

    beforeEach(async () => {
        [
            deployer,
            rewards,
            depositor,
            sentinel,
            minter,
            governance,
            mockAlchemist,
            user
        ] = await ethers.getSigners();

        token = await ERC20MockFactory.connect(deployer).deploy('Mock DAI', 'DAI', 18);

        alUsd = await AlUSDFactory.connect(deployer).deploy();

        mockAlchemistAddress = await mockAlchemist.getAddress();

        alchemist = await AlchemistFactory.connect(deployer).deploy(
            token.address,
            alUsd.address,
            await governance.getAddress(),
            await sentinel.getAddress()
        );
        transmuter = await TransmuterFactory.connect(deployer).deploy(
            alUsd.address,
            token.address,
            await governance.getAddress()
        );
        await transmuter.connect(governance).setTransmutationPeriod(40320);
        await alchemist.connect(governance).setTransmuter(transmuter.address);
        await alchemist.connect(governance).setRewards(await rewards.getAddress());
        await alchemist.connect(governance).setHarvestFee(harvestFee);
        await transmuter.connect(governance).setWhitelist(mockAlchemistAddress, true);

        adapter = await VaultAdapterMockFactory.connect(deployer).deploy(token.address);
        await alchemist.connect(governance).initialize(adapter.address);
        await alchemist.connect(governance).setCollateralizationLimit(collateralizationLimit);
        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(mockAlchemistAddress, utils.parseEther('10000'));
        await token.connect(mockAlchemist).approve(transmuter.address, MAXIMUM_U256);

        await token.mint(await depositor.getAddress(), utils.parseEther('20000'));
        await token.mint(await minter.getAddress(), utils.parseEther('20000'));
        await token.connect(depositor).approve(transmuter.address, MAXIMUM_U256);
        await alUsd.connect(depositor).approve(transmuter.address, MAXIMUM_U256);
        await token.connect(depositor).approve(alchemist.address, MAXIMUM_U256);
        await alUsd.connect(depositor).approve(alchemist.address, MAXIMUM_U256);
        await token.connect(minter).approve(transmuter.address, MAXIMUM_U256);
        await alUsd.connect(minter).approve(transmuter.address, MAXIMUM_U256);
        await token.connect(minter).approve(alchemist.address, MAXIMUM_U256);
        await alUsd.connect(minter).approve(alchemist.address, MAXIMUM_U256);

        await alchemist.connect(depositor).deposit(utils.parseEther('10000'));
        await alchemist.connect(depositor).mint(utils.parseEther('5000'));

        await alchemist.connect(minter).deposit(utils.parseEther('10000'));
        await alchemist.connect(minter).mint(utils.parseEther('5000'));

        transmuter = transmuter.connect(depositor);

        preTestTotalAlUSDSupply = await alUsd.totalSupply();
    });

    describe('stake()', () => {
        it('stakes 1000 alUsd and reads the correct amount', async () => {
            await transmuter.stake(1000);
            expect(await transmuter.depositedAlTokens(await depositor.getAddress())).equal(
                1000
            );
        });

        it('stakes 1000 alUsd two times and reads the correct amount', async () => {
            await transmuter.stake(1000);
            await transmuter.stake(1000);
            expect(await transmuter.depositedAlTokens(await depositor.getAddress())).equal(
                2000
            );
        });
    });

    describe('unstake()', () => {
        it('reverts on depositing and then unstaking balance greater than deposit', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            expect(transmuter.unstake(utils.parseEther('2000'))).revertedWith(
                'Transmuter: unstake amount exceeds deposited amount'
            );
        });

        it('deposits and unstakes 1000 alUSD', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.unstake(utils.parseEther('1000'));
            expect(await transmuter.depositedAlTokens(await depositor.getAddress())).equal(0);
        });

        it('deposits 1000 alUSD and unstaked 500 alUSd', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.unstake(utils.parseEther('500'));
            expect(await transmuter.depositedAlTokens(await depositor.getAddress())).equal(
                utils.parseEther('500')
            );
        });
    });

    describe('distributes correct amount', () => {
        let distributeAmt = utils.parseEther('1000');
        let stakeAmt = utils.parseEther('1000');
        let transmutationPeriod = 20;

        beforeEach(async () => {
            await transmuter.connect(governance).setTransmutationPeriod(transmutationPeriod);
            await token.mint(await minter.getAddress(), utils.parseEther('20000'));
            await token.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await token.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await alchemist.connect(minter).deposit(utils.parseEther('10000'));
            await alchemist.connect(minter).mint(utils.parseEther('5000'));
            await token.mint(await rewards.getAddress(), utils.parseEther('20000'));
            await token.connect(rewards).approve(transmuter.address, MAXIMUM_U256);
            await alUsd.connect(rewards).approve(transmuter.address, MAXIMUM_U256);
            await token.connect(rewards).approve(alchemist.address, MAXIMUM_U256);
            await alUsd.connect(rewards).approve(alchemist.address, MAXIMUM_U256);
            await alchemist.connect(rewards).deposit(utils.parseEther('10000'));
            await alchemist.connect(rewards).mint(utils.parseEther('5000'));
        });

        it('deposits 100000 alUSD, distributes 1000 DAI, and the correct amount of tokens are distributed to depositor', async () => {
            let numBlocks = 5;
            await transmuter.connect(depositor).stake(stakeAmt);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, numBlocks);
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            // pendingdivs should be (distributeAmt * (numBlocks / transmutationPeriod))
            expect(userInfo.pendingdivs).equal(distributeAmt.div(4));
        });

        it('two people deposit equal amounts and recieve equal amounts in distribution', async () => {
            await transmuter.connect(depositor).stake(utils.parseEther('1000'));
            await transmuter.connect(minter).stake(utils.parseEther('1000'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            let userInfo1 = await transmuter.userInfo(await depositor.getAddress());
            let userInfo2 = await transmuter.userInfo(await minter.getAddress());
            expect(userInfo1.pendingdivs).gt(0);
            expect(userInfo1.pendingdivs).equal(userInfo2.pendingdivs);
        });

        it('deposits of 500, 250, and 250 from three people and distribution is correct', async () => {
            await transmuter.connect(depositor).stake(utils.parseEther('500'));
            await transmuter.connect(minter).stake(utils.parseEther('250'));
            await transmuter.connect(rewards).stake(utils.parseEther('250'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            let userInfo1 = await transmuter.userInfo(await depositor.getAddress());
            let userInfo2 = await transmuter.userInfo(await minter.getAddress());
            let userInfo3 = await transmuter.userInfo(await rewards.getAddress());
            let user2 = userInfo2.pendingdivs;
            let user3 = userInfo3.pendingdivs;
            let sumOfTwoUsers = user2.add(user3);
            expect(userInfo1.pendingdivs).gt(0);
            expect(sumOfTwoUsers).equal(userInfo1.pendingdivs);
        });
    });

    describe('transmute() claim() transmuteAndClaim()', () => {
        let distributeAmt = utils.parseEther('500');
        let transmutedAmt = BigNumber.from('12400793650793600');

        it('transmutes the correct amount', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await transmuter.transmute();
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            expect(userInfo.realised).equal(transmutedAmt);
        });

        it('burns the supply of alUSD on transmute()', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await transmuter.transmute();
            let alUSDTokenSupply = await alUsd.totalSupply();
            expect(alUSDTokenSupply).equal(preTestTotalAlUSDSupply.sub(transmutedAmt));
        });

        it('moves DAI from pendingdivs to inbucket upon staking more', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await transmuter.stake(utils.parseEther('100'));
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            expect(userInfo.inbucket).equal(transmutedAmt);
        });

        it('transmutes and claims using transmute() and then claim()', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.transmute();
            await transmuter.claim();
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceAfter).equal(tokenBalanceBefore.add(transmutedAmt));
        });

        it('transmutes and claims using transmuteAndClaim()', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.transmuteAndClaim();
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceAfter).equal(tokenBalanceBefore.add(transmutedAmt));
        });

        it('transmutes the full buffer if a complete phase has passed', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.connect(governance).setTransmutationPeriod(10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 11);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.connect(depositor).transmuteAndClaim();
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceAfter).equal(tokenBalanceBefore.add(distributeAmt));
        });

        it('transmutes the staked amount and distributes overflow if a bucket overflows', async () => {
            // 1) DEPOSITOR stakes 100 dai
            // 2) distribution of 90 dai, let transmutation period pass
            // DEPOSITOR gets 90 dai
            // 3) MINTER stakes 200 dai
            // 4) distribution of 60 dai, let transmutation period pass
            // DEPOSITOR gets 20 dai, MINTER gets 40 dai
            // 5) USER stakes 200 dai (to distribute allocations)
            // 6) transmute DEPOSITOR, bucket overflows by 10 dai
            // MINTER gets 5 dai, USER gets 5 dai
            let distributeAmt0 = utils.parseEther('90');
            let distributeAmt1 = utils.parseEther('60');
            let depStakeAmt0 = utils.parseEther('100');
            let depStakeAmt1 = utils.parseEther('200');
            await transmuter.connect(governance).setTransmutationPeriod(10);
            await token.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await alUsd.connect(user).approve(transmuter.address, MAXIMUM_U256);
            await token.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await token.connect(user).approve(alchemist.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await alUsd.connect(user).approve(alchemist.address, MAXIMUM_U256);
            await token.mint(await minter.getAddress(), utils.parseEther('20000'));
            await alchemist.connect(minter).deposit(utils.parseEther('10000'));
            await alchemist.connect(minter).mint(utils.parseEther('5000'));
            await token.mint(await user.getAddress(), utils.parseEther('20000'));
            await alchemist.connect(user).deposit(utils.parseEther('10000'));
            await alchemist.connect(user).mint(utils.parseEther('5000'));

            // user 1 deposit
            await transmuter.connect(depositor).stake(depStakeAmt0);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt0);
            await mineBlocks(ethers.provider, 10);

            // user 2 deposit
            await transmuter.connect(minter).stake(depStakeAmt1);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt1);
            await mineBlocks(ethers.provider, 10);

            await transmuter.connect(user).stake(depStakeAmt1);

            let minterInfo = await transmuter.userInfo(await minter.getAddress());
            let minterBucketBefore = minterInfo.inbucket;
            await transmuter.connect(depositor).transmuteAndClaim();
            minterInfo = await transmuter.userInfo(await minter.getAddress());
            let userInfo = await transmuter.userInfo(await user.getAddress());

            let minterBucketAfter = minterInfo.inbucket;
            expect(minterBucketAfter).equal(minterBucketBefore.add(parseEther('5')));
            expect(userInfo.inbucket).equal(parseEther('5'));
        });
    });

    describe('transmuteClaimAndWithdraw()', () => {
        let distributeAmt = utils.parseEther('500');
        let transmutedAmt = BigNumber.from('6200396825396800');
        let alUsdBalanceBefore;
        let tokenBalanceBefore;

        beforeEach(async () => {
            tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            alUsdBalanceBefore = await alUsd
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.connect(minter).stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await transmuter.transmuteClaimAndWithdraw();
        });

        it('has a staking balance of 0 alUSD after transmuteClaimAndWithdraw()', async () => {
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            expect(userInfo.depositedAl).equal(0);
            expect(await transmuter.depositedAlTokens(await depositor.getAddress())).equal(0);
        });

        it('returns the amount of alUSD staked less the transmuted amount', async () => {
            let alUsdBalanceAfter = await alUsd
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(alUsdBalanceAfter).equal(alUsdBalanceBefore.sub(transmutedAmt));
        });

        it('burns the correct amount of transmuted alUSD using transmuteClaimAndWithdraw()', async () => {
            let alUSDTokenSupply = await alUsd.totalSupply();
            expect(alUSDTokenSupply).equal(preTestTotalAlUSDSupply.sub(transmutedAmt));
        });

        it('successfully sends DAI to owner using transmuteClaimAndWithdraw()', async () => {
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceAfter).equal(tokenBalanceBefore.add(transmutedAmt));
        });
    });

    describe('exit()', () => {
        let distributeAmt = utils.parseEther('500');
        let transmutedAmt = BigNumber.from('6200396825396800');
        let alUsdBalanceBefore;
        let tokenBalanceBefore;

        beforeEach(async () => {
            tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            alUsdBalanceBefore = await alUsd
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.connect(minter).stake(utils.parseEther('1000'));
            await mineBlocks(ethers.provider, 10);
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await transmuter.exit();
        });

        it('transmutes and then withdraws alUSD from staking', async () => {
            let alUsdBalanceAfter = await alUsd
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(alUsdBalanceAfter).equal(alUsdBalanceBefore.sub(transmutedAmt));
        });

        it('transmutes and claimable DAI moves to realised value', async () => {
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            expect(userInfo.realised).equal(transmutedAmt);
        });

        it('does not claim the realized tokens', async () => {
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceAfter).equal(tokenBalanceBefore);
        });
    });

    describe('forceTransmute()', () => {
        let distributeAmt = utils.parseEther('5000');

        beforeEach(async () => {
            transmuter.connect(governance).setTransmutationPeriod(10);
            await token.mint(await minter.getAddress(), utils.parseEther('20000'));
            await token.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(transmuter.address, MAXIMUM_U256);
            await token.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await alUsd.connect(minter).approve(alchemist.address, MAXIMUM_U256);
            await alchemist.connect(minter).deposit(utils.parseEther('10000'));
            await alchemist.connect(minter).mint(utils.parseEther('5000'));
            await transmuter.connect(depositor).stake(utils.parseEther('.01'));
        });

        it("User 'depositor' has alUSD overfilled, user 'minter' force transmutes user 'depositor' and user 'depositor' has DAI sent to his address", async () => {
            await transmuter.connect(minter).stake(utils.parseEther('10'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.connect(minter).forceTransmute(await depositor.getAddress());
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceBefore).equal(tokenBalanceAfter.sub(utils.parseEther('0.01')));
        });

        it("User 'depositor' has alUSD overfilled, user 'minter' force transmutes user 'depositor' and user 'minter' overflow added inbucket", async () => {
            await transmuter.connect(minter).stake(utils.parseEther('10'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            await transmuter.connect(minter).forceTransmute(await depositor.getAddress());
            let userInfo = await transmuter
                .connect(minter)
                .userInfo(await minter.getAddress());
            // TODO calculate the expected value
            expect(userInfo.inbucket).equal('4999989999999999999999');
        });

        it('you can force transmute yourself', async () => {
            await transmuter.connect(minter).stake(utils.parseEther('1'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.connect(depositor).forceTransmute(await depositor.getAddress());
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceBefore).equal(tokenBalanceAfter.sub(utils.parseEther('0.01')));
        });

        it('you can force transmute yourself even when you are the only one in the transmuter', async () => {
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, distributeAmt);
            await mineBlocks(ethers.provider, 10);
            let tokenBalanceBefore = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            await transmuter.connect(depositor).forceTransmute(await depositor.getAddress());
            let tokenBalanceAfter = await token
                .connect(depositor)
                .balanceOf(await depositor.getAddress());
            expect(tokenBalanceBefore).equal(tokenBalanceAfter.sub(utils.parseEther('0.01')));
        });

        it('reverts when you are not overfilled', async () => {
            await transmuter.connect(minter).stake(utils.parseEther('1000'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, utils.parseEther('1000'));
            expect(
                transmuter.connect(minter).forceTransmute(await depositor.getAddress())
            ).revertedWith('Transmuter: !overflow');
        });
    });
    //not sure what this is actually testing.... REEEE
    describe('Multiple Users displays all overfilled users', () => {
        it('returns userInfo', async () => {
            await transmuter.stake(utils.parseEther('1000'));
            await transmuter.connect(minter).stake(utils.parseEther('1000'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, utils.parseEther('5000'));
            let multipleUsers = await transmuter.getMultipleUserInfo(0, 1);
            let userList = multipleUsers.theUserData;
            expect(userList.length).equal(2);
        });
    });

    describe('distribute()', () => {
        let transmutationPeriod = 20;

        beforeEach(async () => {
            await transmuter.connect(governance).setTransmutationPeriod(transmutationPeriod);
        });

        it('must be whitelisted to call distribute', async () => {
            await transmuter.connect(depositor).stake(utils.parseEther('1000'));
            expect(
                transmuter
                    .connect(depositor)
                    .distribute(alchemist.address, utils.parseEther('1000'))
            ).revertedWith('Transmuter: !whitelisted');
        });

        it('increases buffer size, but does not immediately increase allocations', async () => {
            await transmuter.connect(depositor).stake(utils.parseEther('1000'));
            await transmuter
                .connect(mockAlchemist)
                .distribute(mockAlchemistAddress, utils.parseEther('1000'));
            let userInfo = await transmuter.userInfo(await depositor.getAddress());
            let bufferInfo = await transmuter.bufferInfo();

            expect(bufferInfo._buffer).equal(utils.parseEther('1000'));
            expect(bufferInfo._deltaBlocks).equal(0);
            expect(bufferInfo._toDistribute).equal(0);
            expect(userInfo.pendingdivs).equal(0);
            expect(userInfo.depositedAl).equal(utils.parseEther('1000'));
            expect(userInfo.inbucket).equal(0);
            expect(userInfo.realised).equal(0);
        });

        describe('userInfo()', async () => {
            it('distribute increases allocations if the buffer is already > 0', async () => {
                let blocksMined = 10;
                let stakeAmt = utils.parseEther('1000');
                await transmuter.connect(depositor).stake(stakeAmt);
                await transmuter
                    .connect(mockAlchemist)
                    .distribute(mockAlchemistAddress, utils.parseEther('1000'));
                await mineBlocks(ethers.provider, blocksMined);
                let userInfo = await transmuter.userInfo(await depositor.getAddress());
                let bufferInfo = await transmuter.bufferInfo();

                // 2 = transmutationPeriod / blocksMined
                expect(bufferInfo._buffer).equal(stakeAmt);
                expect(userInfo.pendingdivs).equal(stakeAmt.div(2));
                expect(userInfo.depositedAl).equal(stakeAmt);
                expect(userInfo.inbucket).equal(0);
                expect(userInfo.realised).equal(0);
            });

            it('increases buffer size, and userInfo() shows the correct state without an extra nudge', async () => {
                let stakeAmt = utils.parseEther('1000');
                await transmuter.connect(depositor).stake(stakeAmt);
                await transmuter
                    .connect(mockAlchemist)
                    .distribute(mockAlchemistAddress, stakeAmt);
                await mineBlocks(ethers.provider, 10);
                let userInfo = await transmuter.userInfo(await depositor.getAddress());
                let bufferInfo = await transmuter.bufferInfo();

                expect(bufferInfo._buffer).equal('1000000000000000000000');
                expect(userInfo.pendingdivs).equal(stakeAmt.div(2));
                expect(userInfo.depositedAl).equal(stakeAmt);
                expect(userInfo.inbucket).equal(0);
                expect(userInfo.realised).equal(0);
            });
        });
    });
});
