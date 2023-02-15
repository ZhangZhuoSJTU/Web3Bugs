const MockGvtTokenToken = artifacts.require('MockGvtToken');
const MockPWRDToken = artifacts.require('MockPWRDToken');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDT');
const MockVaultAdaptor = artifacts.require('MockVaultAdaptor');
const CurvePool = artifacts.require('StableSwap3Pool');
const MockLPT = artifacts.require('CurveTokenV2');
const MockAggregatorC = artifacts.require('MockAggregator');
const Buoy = artifacts.require('Buoy3Pool');
const LifeGuard = artifacts.require('LifeGuard3Pool');
const MockController = artifacts.require('MockController');
const { BN, toBN } = require('web3-utils');
const { expect, ZERO, decodeLogs } = require('../utils/common-utils');
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

contract('lifeguard test', function (accounts) {
	//chain
	const chainlinkPrices = ['2245940000000000', '2218500000000000', '2208500000000000'];
	const decimals = ['1000000000000000000', '1000000', '1000000'];
	const [governance, user] = accounts;
	let //tokens
		tokens,
		pairs,
		mockDAI,
		mockUSDC,
		mockUSDT,
		mockDAIVault,
		mockUSDCVault,
		mockUSDTVault,
		mockCurveVault,
		mockLPT,
		mockPair0,
		mockPair1,
		mockPair2,
		mockVault,
		mockPWRD,
		//lifeguard
		lifeGuard,
		buoy,
		//chainlink
		mockController,
		//3rd party
		buffer,
		threshold,
		curve3Pool;

	beforeEach('Setup curveOracle and mocks before tests', async function () {
		mockDAI = await MockDAI.new();
		mockUSDC = await MockUSDC.new();
		mockUSDT = await MockUSDT.new();
		mockLPT = await MockLPT.new('LPT', 'LPT', '18', 0);

		mockDAIVault = await MockVaultAdaptor.new();
		mockUSDCVault = await MockVaultAdaptor.new();
		mockUSDTVault = await MockVaultAdaptor.new();
		mockCurveVault = await MockVaultAdaptor.new();

		await mockDAIVault.setUnderlyingToken(mockDAI.address);
		await mockUSDCVault.setUnderlyingToken(mockUSDC.address);
		await mockUSDTVault.setUnderlyingToken(mockUSDT.address);
		await mockCurveVault.setUnderlyingToken(mockLPT.address);

		tokens = [mockDAI.address, mockUSDC.address, mockUSDT.address];
		mockController = await MockController.new('CTRTOKEN', 'CTRTOKEN');

		// Gro dollars/vaults
		mockVault = await MockGvtTokenToken.new();
		mockPWRD = await MockPWRDToken.new();
		await mockVault.transferOwnership(mockController.address);
		await mockPWRD.transferOwnership(mockController.address);

		//set up chainlink oracle
		daiEthAgg = await MockAggregatorC.new(chainlinkPrices[0]);
		usdcEthAgg = await MockAggregatorC.new(chainlinkPrices[1]);
		usdtEthAgg = await MockAggregatorC.new(chainlinkPrices[2]);

		//set up 3pool
		const _owner = accounts[0];
		const _pool_token = mockLPT.address;
		const _A = '200';
		const _fee = '4000000';
		const _admin_fee = '5000000000';
		const _coins = tokens;
		curve3Pool = await CurvePool.new(_owner, _coins, _pool_token, _A, _fee, _admin_fee);
		await mockLPT.set_minter(curve3Pool.address);

		//Move liqudity to 3pool
		daiAmount = new BN('84873231441236551059274931');
		usdcAmount = new BN('87996275469023');
		usdtAmount = new BN('90634945135499');
		await mockDAI.mint(accounts[0], daiAmount);
		await mockUSDC.mint(accounts[0], usdcAmount);
		await mockUSDT.mint(accounts[0], usdtAmount);

		await mockDAI.approve(curve3Pool.address, daiAmount);
		await mockUSDC.approve(curve3Pool.address, usdcAmount);
		await mockUSDT.approve(curve3Pool.address, usdtAmount);

		am_ = [daiAmount, usdcAmount, usdtAmount];

		await curve3Pool.add_liquidity(am_, 0, {
			from: accounts[0],
			gas: '6721975',
			allow_revert: true,
		});

		//set up buoy
		buoy = await Buoy.new(
            curve3Pool.address,
            mockLPT.address,
            tokens,
            decimals,
            [daiEthAgg.address, usdcEthAgg.address, usdtEthAgg.address]
        );

		await buoy.setBasisPointsLmit('1000');

		lifeGuard = await LifeGuard.new(curve3Pool.address, mockLPT.address, buoy.address, tokens, decimals);
		await lifeGuard.setController(mockController.address, { from: governance });
		await lifeGuard.setDependencies({ from: governance });
		await lifeGuard.addToWhitelist(governance, { from: governance });
		await mockController.addPool(lifeGuard.address, tokens);
		await mockController.setDelta(['3000', '3000', '4000']);
		await mockController.setUnderlyingTokens([mockDAI.address, mockUSDC.address, mockUSDT.address]);
		await mockController.setVault(0, mockDAIVault.address);
		await mockController.setVault(1, mockUSDCVault.address);
		await mockController.setVault(2, mockUSDTVault.address);
		await mockController.setVaultOrder([0, 1, 2]);
		await mockController.setCurveVault(mockCurveVault.address);
		await mockController.setGvt(mockVault.address);
		await mockController.setPwrd(mockPWRD.address);
		await mockController.setLifeGuard(lifeGuard.address);
		await mockController.setSkimPercent(0);

		//set up liquidity
		await mockDAI.mint(user, '10000000000000000000000000');
		await mockUSDC.mint(user, '1000000000000');
		await mockUSDT.mint(user, '1000000000000');

		//approve spending
		await mockDAI.approve(mockController.address, '10000000000000000000000000', { from: user });
		await mockUSDC.approve(mockController.address, '10000000000000', { from: user });
		await mockUSDT.approve(mockController.address, '10000000000000', { from: user });

		await lifeGuard.approveVaults(0);
		await lifeGuard.approveVaults(1);
		await lifeGuard.approveVaults(2);
		await lifeGuard.approveVaults(3);

		snapshotId = (await timeMachine.takeSnapshot())['result'];
	});

	afterEach(async () => {
		await timeMachine.revertToSnapshot(snapshotId);
	});

	describe('Buoy floats', function () {
		it('Should be possible to set a new basis point limit for the safety check', async function () {
			await expect(buoy.setBasisPointsLmit('200')).to.be.fulfilled;
			return expect(buoy.BASIS_POINTS()).to.eventually.be.a.bignumber.equal(new BN('200'));
		});

		it('Should return true if the safety check runs within given paramaters', async function () {
			return expect(buoy.safetyCheck()).to.be.fulfilled;
		});

		it('Should be possibe to update cached token ratios', async function () {
			return expect(buoy.updateRatios()).to.be.fulfilled;
		});

		it('Should return false if the safety check runs outside given paramaters', async function () {
			await buoy.setBasisPointsLmit('1');
			return expect(buoy.safetyCheck()).to.eventually.be.false;
		});

		it('Should get the correct USD amount for tokens', async function () {
			const lpAmount = await curve3Pool.calc_token_amount(decimals, true);
			const vp = await curve3Pool.get_virtual_price();
			const expectedUsd = lpAmount.mul(vp).div(new BN(decimals[0]));
			return expect(buoy.stableToUsd(decimals, true)).to.eventually.be.a.bignumber.closeTo(
				expectedUsd,
				decimals[0]
			);
		});

		it('Should get the correct LP amount for tokens', async function () {
			const lpAmount = await curve3Pool.calc_token_amount(decimals, true);
			return expect(buoy.stableToLp(decimals, true)).to.eventually.be.a.bignumber.closeTo(
				lpAmount,
				decimals[0]
			);
		});

		it('Should return correct single toke amount for LP (DAI)', async function () {
			const tokenAmount = await curve3Pool.calc_withdraw_one_coin(decimals[0], 0);
			return expect(buoy.singleStableFromLp(decimals[0], 0)).to.eventually.be.a.bignumber.closeTo(
				tokenAmount,
				decimals[0]
			);
		});

		it('Should return correct single toke amount for LP (USDC)', async function () {
			const tokenAmount = await curve3Pool.calc_withdraw_one_coin(decimals[1], 1);
			return expect(buoy.singleStableFromLp(decimals[1], 1)).to.eventually.be.a.bignumber.closeTo(
				tokenAmount,
				decimals[1]
			);
		});

		it('Should return correct single toke amount for LP (USDT)', async function () {
			const tokenAmount = await curve3Pool.calc_withdraw_one_coin(decimals[2], 2);
			return expect(buoy.singleStableFromLp(decimals[2], 2)).to.eventually.be.a.bignumber.closeTo(
				tokenAmount,
				decimals[2]
			);
		});

		it('Should get the correct USD amount of LP token', async function () {
			const vp = await curve3Pool.get_virtual_price();
			const expectedUsd = new BN('3000000000000000000').mul(vp).div(new BN(decimals[0]));
			return expect(buoy.lpToUsd('3000000000000000000')).to.eventually.be.a.bignumber.closeTo(
				expectedUsd,
				decimals[0]
			);
		});

		it('Should get the correct lp amount from USD', async function () {
			const vp = await curve3Pool.get_virtual_price();
			const expectedUsd = new BN('3000000000000000000').mul(vp).div(new BN(decimals[0]));
			return expect(buoy.lpToUsd('3000000000000000000')).to.eventually.be.a.bignumber.closeTo(
				expectedUsd,
				decimals[0]
			);
		});

		it('Should get correct amount of USD from a single asset', async function () {
			return expect(buoy.usdToLp('1000000000000000000000')).to.eventually.be.a.bignumber.closeTo(
				'1000000000000000000000',
				decimals[0]
			);
		});

		it('Should get correct amount of USD from a single asset', async function () {
			return expect(buoy.singleStableToUsd('1000000000', 1)).to.eventually.be.a.bignumber.closeTo(
				'1000000000000000000000',
				decimals[0]
			);
		});

		it('Should get the correct amount of a single asset from usd', async function () {
			return expect(
				buoy.singleStableFromUsd('1000000000000000000000', 1)
			).to.eventually.be.a.bignumber.closeTo('1000000000', decimals[1]);
		});
	});

	describe('LifeGuard to the rescue', function () {
		it('Should be possible to deposit stablecoins to the LifeGuard', async function () {
			const baseNum = new BN(10).pow(await mockDAI.decimals());
			await expect(
				mockController.depositGvt(['3000000000000000000', '3000000', '4000000'], 1, ZERO, {
					from: user,
				})
			).to.be.fulfilled;

			await mockController.setWhale(true);
			const expectedDai = await mockDAI.balanceOf(mockDAIVault.address);
			await expect(buoy.lpToUsd(new BN('7').mul(baseNum))).to.eventually.be.a.bignumber.closeTo(
				toBN(expectedDai),
				decimals[0]
			);

			await expect(
				mockController.depositPwrd(['3000000000000000000', '3000000', '4000000'], 1, ZERO, {
					from: user,
				})
			).to.be.fulfilled;

			const finalDai = await mockDAI.balanceOf(mockDAIVault.address); // 10 + 3
			const finalUsdc = await mockUSDC.balanceOf(mockUSDCVault.address);
			const finalUsdt = await mockUSDT.balanceOf(mockUSDTVault.address);
			await expect(buoy.lpToUsd('10000000000000000000')).to.eventually.be.a.bignumber.closeTo(
				toBN(finalDai),
				decimals[0]
			);
			await expect(buoy.lpToUsd('3000000')).to.eventually.be.a.bignumber.closeTo(
				toBN(finalUsdc),
				decimals[0]
			);
			return expect(buoy.lpToUsd('4000000')).to.eventually.be.a.bignumber.closeTo(
				toBN(finalUsdt),
				decimals[0]
			);
		});

		it('Should correctly swap asset to target when depositing', async function () {
			await mockController.setVaultOrder([2, 1, 0]);
			await expect(
				mockController.depositGvt(['2000000000000000000', 0, 0], 1, ZERO, { from: user })
			).to.eventually.be.fulfilled;

			const finalUsdt = await mockUSDT.balanceOf(mockUSDTVault.address);

			return expect(buoy.lpToUsd('2000000')).to.eventually.be.a.bignumber.closeTo(
				toBN(finalUsdt),
				decimals[0]
			);
		});

		it('It should be possible to withdraw', async function () {
			const amounts = ['2000000000000000000', '2000000', '2000000'];
			await mockController.setWhale(true);

			await mockController.depositGvt(amounts, 1, ZERO, { from: user });

			const calcLp = await curve3Pool.calc_token_amount(amounts, false);
			const lp = calcLp.sub(calcLp.div(new BN('10000')));

			return expect(
				mockController.withdrawByLPToken(false, lp, [0, 0, 0], { from: user })
			).to.be.fulfilled;
		});

		it('It should return the correct amount on a balanced withdrawal', async function () {
			const amounts = ['20000000000000000000', '20000000', '20000000'];
			await mockController.setWhale(true);
			const initDai = await mockDAI.balanceOf(user);
			const initUsdc = await mockUSDC.balanceOf(user);
			const initUsdt = await mockUSDT.balanceOf(user);

			await mockController.depositGvt(amounts, 1, ZERO, { from: user });

			const userDai = await mockDAI.balanceOf(user);
			const userUsdc = await mockUSDC.balanceOf(user);
			const userUsdt = await mockUSDT.balanceOf(user);

			await expect(toBN(userDai)).to.be.bignumber.lt(toBN(initDai));
			await expect(toBN(userUsdc)).to.be.bignumber.lt(toBN(initUsdc));
			await expect(toBN(userUsdt)).to.be.bignumber.lt(toBN(initUsdt));

			const calcLp = await curve3Pool.calc_token_amount(amounts, true);
			const lp = calcLp.sub(calcLp.div(new BN('10000')));

			await mockController.withdrawByLPToken(false, lp, [0, 0, 0], { from: user });

			const finalDai = await mockDAI.balanceOf(user);
			const finalUsdc = await mockUSDC.balanceOf(user);
			const finalUsdt = await mockUSDT.balanceOf(user);
			await expect(toBN(userDai)).to.be.bignumber.lt(toBN(finalDai));
			await expect(toBN(userUsdc)).to.be.bignumber.lt(toBN(finalUsdc));
			return expect(toBN(userUsdt)).to.be.bignumber.lt(toBN(finalUsdt));
		});

		it('It should return the correct amount on a single asset withdrawal', async function () {
			const amounts = ['2000000000000000000', '0', '2000000'];
			await mockController.setWhale(true);

			const initUsdc = await mockUSDC.balanceOf(user);
			await mockController.depositGvt(amounts, 1, ZERO, { from: user });

			const userUsdc = await mockUSDC.balanceOf(user);
			await expect(toBN(userUsdc)).to.be.bignumber.equal(toBN(initUsdc));

			const calcLp = await curve3Pool.calc_token_amount(amounts, true);
			const lp = calcLp.sub(calcLp.div(new BN('10000')));

			await mockController.withdrawByStablecoin(false, 1, lp, lp, { from: user });

			const finalUsdc = await mockUSDC.balanceOf(user);
			await expect(toBN(userUsdc)).to.be.bignumber.lt(toBN(finalUsdc));
		});

		it('Should skim from large deposits', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			const usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
			const usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());

			await mockController.setSkimPercent(1000);
			let investAmount = [
				toBN(100).mul(daiBaseNum),
				toBN(100).mul(usdcBaseNum),
				toBN(100).mul(usdtBaseNum),
			];
			await mockController.depositGvt(investAmount, 1, ZERO, { from: user });
			await mockController.setWhale(true);

			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(301).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(10).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(toBN(0).mul(usdtBaseNum));

			await mockController.depositPwrd(investAmount, 1, ZERO, { from: user });
			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(402).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdtBaseNum)
			);

			const amounts = ['1000000000000000000', '1000000', '1000000'];
			const calcLp = await curve3Pool.calc_token_amount(amounts, true);
			const lp = calcLp.sub(calcLp.div(new BN('10000')));
		});

		it('Should not return skimmed assets during withdrawals', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			const usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
			const usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());

			await mockController.setSkimPercent(1000);
			let investAmount = [
				toBN(100).mul(daiBaseNum),
				toBN(100).mul(usdcBaseNum),
				toBN(100).mul(usdtBaseNum),
			];
			await mockController.depositGvt(investAmount, 1, ZERO, { from: user });
			await mockController.setWhale(true);

			await mockController.depositPwrd(investAmount, 1, ZERO, { from: user });

			const amounts = ['1000000000000000000', '1000000', '1000000'];
			const calcLp = await curve3Pool.calc_token_amount(amounts, true);
			const lp = calcLp.sub(calcLp.div(new BN('10000')));

			await mockController.setWhale(false);

			await mockController.withdrawByStablecoin(false, 0, lp, 1, { from: user });

			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(402).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdtBaseNum)
			);

			await mockController.withdrawByLPToken(true, lp, [0, 0, 0], { from: user });

			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(402).mul(daiBaseNum)
			);
			await expect(mockDAI.balanceOf(lifeGuard.address)).to.eventually.be.a.bignumber.most(
				toBN(402).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(mockUSDC.balanceOf(lifeGuard.address)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(mockUSDT.balanceOf(lifeGuard.address)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdtBaseNum)
			);
		});

		it('Should deposit all skimmed assets to curve', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			const usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
			const usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());

			await mockController.setSkimPercent(1000);
			let investAmount = [
				toBN(100).mul(daiBaseNum),
				toBN(100).mul(usdcBaseNum),
				toBN(100).mul(usdtBaseNum),
			];
			await mockController.depositGvt(investAmount, 1, ZERO, { from: user });
			await mockController.setWhale(true);

			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(301).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(10).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(toBN(0).mul(usdtBaseNum));

			await mockController.depositPwrd(investAmount, 1, ZERO, { from: user });
			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(
				toBN(402).mul(daiBaseNum)
			);
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdcBaseNum)
			);
			await expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.most(
				toBN(101).mul(usdtBaseNum)
			);

			// return expect(await mockLPT.balanceOf(lifeGuard.address))
			//     .to.eventually.be.a.bignumber.equal(toBN(0))

			await mockController.depositStablePool(true, { from: governance });

			await expect(lifeGuard.assets(0)).to.eventually.be.a.bignumber.most(toBN(0).mul(daiBaseNum));
			await expect(lifeGuard.assets(1)).to.eventually.be.a.bignumber.most(toBN(0).mul(usdcBaseNum));
			return expect(lifeGuard.assets(2)).to.eventually.be.a.bignumber.equal(
				toBN(0).mul(usdtBaseNum)
			);
			return expect(await mockLPT.balanceOf(lifeGuard.address)).to.eventually.be.a.bignumber.least(
				toBN(0).mul(daiBaseNum)
			);
		});

		it('It should be possible to set new tokens', async function () { });
	});
	describe('LifeGuard invest', function () {
		beforeEach('Setup skim assets', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			const usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
			const usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());
			await mockController.setSkimPercent(1000);
			let investAmount = [
				toBN(100).mul(daiBaseNum),
				toBN(100).mul(usdcBaseNum),
				toBN(100).mul(usdtBaseNum),
			];
			await mockController.setWhale(true);
			await mockController.depositGvt(investAmount, 1, ZERO, { from: user });
		});
		it('Should trigger invest to curve when exceed the threshold', async function () {
			await lifeGuard.setInvestToCurveThreshold(20);
			const trigger = await lifeGuard.investToCurveVaultTrigger();
			return expect(trigger).to.be.true;
		});

		it('Should not trigger invest to curve when exceed the threshold', async function () {
			await lifeGuard.setInvestToCurveThreshold(30);
			const trigger = await lifeGuard.investToCurveVaultTrigger();
			return expect(trigger).to.be.false;
		});

		it('Should be possible to set dependencies', async function () {
			return expect(lifeGuard.setDependencies()).to.eventually.be.fulfilled;
		});

		it('Should be possible to trigger the health check on and off', async function () {
		});

		it('Should be possible to invest to the curve vault', async function () {
			await lifeGuard.setInvestToCurveThreshold(20);
			await expect(lifeGuard.totalAssets()).to.eventually.be.a.bignumber.least(new BN(1));
			await expect(lifeGuard.investToCurveVault()).to.be.fulfilled;
			return expect(lifeGuard.totalAssets()).to.eventually.be.a.bignumber.equal(new BN(0));
		});

		it('Should be possible to distribute lifeguard assets to stablecoin vaults', async function () {
			await lifeGuard.setInvestToCurveThreshold(20);
			const assetsPre = await mockLPT.balanceOf(mockCurveVault.address);
			await expect(lifeGuard.investToCurveVault()).to.be.fulfilled;
			const assetsPost = await mockLPT.balanceOf(mockCurveVault.address);
			const preDai = await mockDAI.balanceOf(mockDAIVault.address);
			await expect(mockController.distributeCurveAssets(assetsPost, [5000, 2500, 2500])).to.be.fulfilled;
			return expect(
				mockDAI.balanceOf(mockDAIVault.address)
			).to.eventually.be.a.bignumber.greaterThan(new BN(preDai));
		});

		it('Should be possible to get available LP in lifeguard', async function () {
			return expect(lifeGuard.availableLP()).to.eventually.be.a.bignumber.equal(toBN(0));
		});

		it('Should be possible to get available USD in lifeguard', async function () {
			return expect(lifeGuard.availableUsd()).to.eventually.be.a.bignumber.equal(toBN(0));
		});

		it('Should be possible to get lifeguard total assets (LP)', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			return expect(lifeGuard.totalAssets()).to.eventually.be.a.bignumber.closeTo(
				toBN(30).mul(daiBaseNum),
				daiBaseNum
			);
		});

		it('Should be possible to get lifeguard total assets (USD)', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			return expect(lifeGuard.totalAssetsUsd()).to.eventually.be.a.bignumber.closeTo(
				toBN(30).mul(daiBaseNum),
				daiBaseNum
			);
		});

		it('Should be possible to invest all lg assets', async function () {
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			const usdcBaseNum = new BN(10).pow(await mockUSDC.decimals());
			const usdtBaseNum = new BN(10).pow(await mockUSDT.decimals());
			let investAmount = [
				toBN(100).mul(daiBaseNum),
				toBN(100).mul(usdcBaseNum),
				toBN(100).mul(usdtBaseNum),
			];
			await mockDAI.transfer(lifeGuard.address, investAmount[0], { from: user });
			await mockUSDC.transfer(lifeGuard.address, investAmount[1], { from: user });
			await mockUSDT.transfer(lifeGuard.address, investAmount[2], { from: user });
			await mockController.depositPool({ from: governance });
			const trx = await expect(mockController.investPool(0, [4000, 3000, 3000])).to.eventually.be.fulfilled;
			const tx = await web3.eth.getTransactionReceipt(trx.tx);
			const invest = await decodeLogs(tx.logs, LifeGuard, lifeGuard.address, 'LogNewInvest');
			await expect(invest[0].args[0]).to.be.a.bignumber.closeTo(
				new BN('300').mul(daiBaseNum),
				daiBaseNum
			);
			return expect(invest[0].args[3]).to.be.a.bignumber.closeTo(
				new BN('300').mul(daiBaseNum),
				daiBaseNum
			);
		});

		it('Should be possible to deposit for rebalance', async function () {
			const baseNum = new BN(10).pow(await mockDAI.decimals());
			const trx = await mockController.depositStablePool(true);
			const tx = await web3.eth.getTransactionReceipt(trx.tx);
			const deposit = await decodeLogs(
				tx.logs,
				LifeGuard,
				lifeGuard.address,
				'LogNewStableDeposit'
			);
			return expect(deposit[0].args[1]).to.be.a.bignumber.closeTo(
				new BN('30').mul(baseNum),
				baseNum
			);
		});
	});

	describe('Manipulate curve', function () {
		it('Should be possible to deposit for rebalance', async function () {
            const origDaiUsdc = await curve3Pool.get_dy(0, 1, '1000000000000000000')
            const origDaiUsdt = await curve3Pool.get_dy(0, 2, '1000000000000000000')
			const daiBaseNum = new BN(10).pow(await mockDAI.decimals());
			let investAmount = [
				toBN(10000).mul(daiBaseNum),
				toBN(0),
				toBN(0),
			];
			await mockDAI.transfer(lifeGuard.address, investAmount[0], { from: user });
			await mockController.depositPool({ from: governance });
			let trx = await expect(mockController.investPool(0, [2000, 4000, 4000])).to.eventually.be.fulfilled;
			let tx = await web3.eth.getTransactionReceipt(trx.tx);
			let invest = await decodeLogs(tx.logs, LifeGuard, lifeGuard.address, 'LogNewInvest');

            daiAmount = new BN('504873231441236551059274931');
            await mockDAI.mint(accounts[0], daiAmount);
            await mockDAI.approve(curve3Pool.address, daiAmount);

            await curve3Pool.add_liquidity(investAmount, 0, {
                from: accounts[0],
                gas: '6721975',
                allow_revert: true,
            });

			await mockDAI.transfer(lifeGuard.address, investAmount[0], { from: user });
			await mockController.depositPool({ from: governance });
            const finDaiUsdc = await curve3Pool.get_dy(0, 1, '1000000000000000000')
            const finDaiUsdt = await curve3Pool.get_dy(0, 2, '1000000000000000000')

			trx = await expect(mockController.investPool(0, [2000, 4000, 4000])).to.eventually.be.fulfilled;
			tx = await web3.eth.getTransactionReceipt(trx.tx);
			invest = await decodeLogs(tx.logs, LifeGuard, lifeGuard.address, 'LogNewInvest');
		});
    })
});
