import { Signer } from '@ethersproject/abstract-signer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { MockContract } from 'ethereum-waffle';
import { ethers, waffle } from 'hardhat';

import {
  AaveV3YieldSourceHarness,
  AaveV3YieldSourceHarness__factory,
  ERC20Mintable,
} from '../types';

import IAToken from '../abis/IAToken.json';
import IRewardsController from '../abis/IRewardsController.json';
import IPool from '../abis/IPool.json';
import IPoolAddressesProvider from '../abis/IPoolAddressesProvider.json';
import IPoolAddressesProviderRegistry from '../abis/IPoolAddressesProviderRegistry.json';
import SafeERC20Wrapper from '../abis/SafeERC20Wrapper.json';

const { constants, getContractFactory, getSigners, utils } = ethers;
const { AddressZero, MaxUint256 } = constants;
const { parseEther: toWei } = utils;

const DECIMALS = 6;
const REFERRAL_CODE = 188;

describe('AaveV3YieldSource', () => {
  let contractsOwner: Signer;
  let yieldSourceOwner: SignerWithAddress;
  let wallet2: SignerWithAddress;

  let aToken: MockContract;
  let rewardsController: MockContract;
  let pool: MockContract;
  let poolAddressesProvider: MockContract;
  let poolAddressesProviderRegistry: MockContract;

  let aaveV3YieldSource: AaveV3YieldSourceHarness;

  let erc20Token: MockContract;
  let usdcToken: ERC20Mintable;

  let constructorTest = false;

  const deployAaveV3YieldSource = async (
    aTokenAddress: string,
    rewardsControllerAddress: string,
    poolAddressesProviderRegistryAddress: string,
    decimals: number,
    owner: string,
  ): Promise<AaveV3YieldSourceHarness> => {
    const AaveV3YieldSource = (await ethers.getContractFactory(
      'AaveV3YieldSourceHarness',
    )) as AaveV3YieldSourceHarness__factory;

    return await AaveV3YieldSource.deploy(
      aTokenAddress,
      rewardsControllerAddress,
      poolAddressesProviderRegistryAddress,
      'PoolTogether aUSDC Yield',
      'PTaUSDCY',
      decimals,
      owner,
    );
  };

  const supplyTokenTo = async (
    user: SignerWithAddress,
    amount: BigNumber,
    aTokenTotalSupply: BigNumber,
  ) => {
    const tokenAddress = await aaveV3YieldSource.tokenAddress();
    const userAddress = user.address;

    await usdcToken.mint(userAddress, amount);
    await usdcToken.connect(user).approve(aaveV3YieldSource.address, MaxUint256);

    await pool.mock.supply
      .withArgs(tokenAddress, amount, aaveV3YieldSource.address, REFERRAL_CODE)
      .returns();

    // aTokenTotalSupply should never be 0 since we mint shares to the user after depositing in Aave
    await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(aTokenTotalSupply);

    await aaveV3YieldSource.connect(user).supplyTokenTo(amount, userAddress);
  };

  const sharesToToken = async (shares: BigNumber, yieldSourceTotalSupply: BigNumber) => {
    const totalShares = await aaveV3YieldSource.callStatic.totalSupply();

    // tokens = (shares * yieldSourceATokenTotalSupply) / totalShares
    return shares.mul(yieldSourceTotalSupply).div(totalShares);
  };

  beforeEach(async () => {
    const { deployMockContract } = waffle;

    [contractsOwner, yieldSourceOwner, wallet2] = await getSigners();

    const ERC20MintableContract = await getContractFactory('ERC20Mintable', contractsOwner);

    erc20Token = await deployMockContract(contractsOwner, SafeERC20Wrapper);

    usdcToken = (await ERC20MintableContract.deploy('USD Coin', 'USDC', 6)) as ERC20Mintable;

    aToken = await deployMockContract(contractsOwner, IAToken);
    await aToken.mock.UNDERLYING_ASSET_ADDRESS.returns(usdcToken.address);

    pool = await deployMockContract(contractsOwner, IPool);

    rewardsController = await deployMockContract(contractsOwner, IRewardsController);

    poolAddressesProvider = await deployMockContract(contractsOwner, IPoolAddressesProvider);

    poolAddressesProviderRegistry = await deployMockContract(
      contractsOwner,
      IPoolAddressesProviderRegistry,
    );

    await poolAddressesProvider.mock.getPool.returns(pool.address);
    await poolAddressesProviderRegistry.mock.getAddressesProvidersList.returns([
      poolAddressesProvider.address,
    ]);

    if (!constructorTest) {
      aaveV3YieldSource = await deployAaveV3YieldSource(
        aToken.address,
        rewardsController.address,
        poolAddressesProviderRegistry.address,
        DECIMALS,
        yieldSourceOwner.address,
      );
    }
  });

  describe('constructor()', () => {
    beforeEach(() => {
      constructorTest = true;
    });

    afterEach(() => {
      constructorTest = false;
    });

    it('should deploy a new AaveV3YieldSource', async () => {
      const aaveV3YieldSource = await deployAaveV3YieldSource(
        aToken.address,
        rewardsController.address,
        poolAddressesProviderRegistry.address,
        DECIMALS,
        yieldSourceOwner.address,
      );

      await expect(aaveV3YieldSource.deployTransaction)
        .to.emit(aaveV3YieldSource, 'AaveV3YieldSourceInitialized')
        .withArgs(
          aToken.address,
          rewardsController.address,
          poolAddressesProviderRegistry.address,
          'PoolTogether aUSDC Yield',
          'PTaUSDCY',
          DECIMALS,
          yieldSourceOwner.address,
        );
    });

    it('should fail if aToken is address zero', async () => {
      await expect(
        deployAaveV3YieldSource(
          AddressZero,
          rewardsController.address,
          poolAddressesProviderRegistry.address,
          DECIMALS,
          yieldSourceOwner.address,
        ),
      ).to.be.revertedWith('AaveV3YS/aToken-not-zero-address');
    });

    it('should fail if rewardsController is address zero', async () => {
      await expect(
        deployAaveV3YieldSource(
          aToken.address,
          AddressZero,
          poolAddressesProviderRegistry.address,
          DECIMALS,
          yieldSourceOwner.address,
        ),
      ).to.be.revertedWith('AaveV3YS/RC-not-zero-address');
    });

    it('should fail if poolAddressesProviderRegistry is address zero', async () => {
      await expect(
        deployAaveV3YieldSource(
          aToken.address,
          rewardsController.address,
          AddressZero,
          DECIMALS,
          yieldSourceOwner.address,
        ),
      ).to.be.revertedWith('AaveV3YS/PR-not-zero-address');
    });

    it('should fail if owner is address zero', async () => {
      await expect(
        deployAaveV3YieldSource(
          aToken.address,
          rewardsController.address,
          poolAddressesProviderRegistry.address,
          DECIMALS,
          AddressZero,
        ),
      ).to.be.revertedWith('AaveV3YS/owner-not-zero-address');
    });

    it('should fail if token decimal is not greater than 0', async () => {
      await expect(
        deployAaveV3YieldSource(
          aToken.address,
          rewardsController.address,
          poolAddressesProviderRegistry.address,
          0,
          yieldSourceOwner.address,
        ),
      ).to.be.revertedWith('AaveV3YS/decimals-gt-zero');
    });
  });

  describe('decimals()', () => {
    it('should return the ERC30 token decimals number', async () => {
      expect(await aaveV3YieldSource.decimals()).to.equal(DECIMALS);
    });
  });

  describe('depositToken()', () => {
    it('should return the underlying token', async () => {
      expect(await aaveV3YieldSource.depositToken()).to.equal(usdcToken.address);
    });
  });

  describe('balanceOfToken()', () => {
    it('should return user balance', async () => {
      const firstAmount = toWei('100');
      const yieldSourceTotalSupply = firstAmount.mul(2);

      await supplyTokenTo(yieldSourceOwner, firstAmount, firstAmount);
      await supplyTokenTo(yieldSourceOwner, firstAmount, yieldSourceTotalSupply);

      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(yieldSourceTotalSupply);

      const shares = await aaveV3YieldSource.callStatic.balanceOf(yieldSourceOwner.address);
      const tokens = await sharesToToken(shares, yieldSourceTotalSupply);

      expect(await aaveV3YieldSource.callStatic.balanceOfToken(yieldSourceOwner.address)).to.equal(
        tokens,
      );
    });
  });

  describe('_tokenToShares()', () => {
    it('should return shares amount', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await aaveV3YieldSource.mint(wallet2.address, toWei('100'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('1000'));

      expect(await aaveV3YieldSource.tokenToShares(toWei('10'))).to.equal(toWei('2'));
    });

    it('should return 0 if tokens param is 0', async () => {
      expect(await aaveV3YieldSource.tokenToShares('0')).to.equal('0');
    });

    it('should return tokens if totalSupply is 0', async () => {
      expect(await aaveV3YieldSource.tokenToShares(toWei('100'))).to.equal(toWei('100'));
    });

    it('should return shares even if aToken total supply has a lot of decimals', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('1'));
      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(toWei('0.000000000000000005'));

      expect(await aaveV3YieldSource.tokenToShares(toWei('0.000000000000000005'))).to.equal(
        toWei('1'),
      );
    });

    it('should return shares even if aToken total supply increases', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await aaveV3YieldSource.mint(wallet2.address, toWei('100'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('100'));

      expect(await aaveV3YieldSource.tokenToShares(toWei('1'))).to.equal(toWei('2'));

      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(ethers.utils.parseUnits('100', 36));
      expect(await aaveV3YieldSource.tokenToShares(toWei('1'))).to.equal(2);
    });

    it('should fail to return shares if aToken total supply increases too much', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await aaveV3YieldSource.mint(wallet2.address, toWei('100'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('100'));

      expect(await aaveV3YieldSource.tokenToShares(toWei('1'))).to.equal(toWei('2'));

      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(ethers.utils.parseUnits('100', 37));
      await expect(aaveV3YieldSource.supplyTokenTo(toWei('1'), wallet2.address)).to.be.revertedWith(
        'AaveV3YS/shares-gt-zero',
      );
    });
  });

  describe('_sharesToToken()', () => {
    it('should return tokens amount', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await aaveV3YieldSource.mint(wallet2.address, toWei('100'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('1000'));

      expect(await aaveV3YieldSource.sharesToToken(toWei('2'))).to.equal(toWei('10'));
    });

    it('should return shares if totalSupply is 0', async () => {
      expect(await aaveV3YieldSource.sharesToToken(toWei('100'))).to.equal(toWei('100'));
    });

    it('should return tokens even if totalSupply has a lot of decimals', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('0.000000000000000005'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('100'));

      expect(await aaveV3YieldSource.sharesToToken(toWei('0.000000000000000005'))).to.equal(
        toWei('100'),
      );
    });

    it('should return tokens even if aToken total supply increases', async () => {
      await aaveV3YieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await aaveV3YieldSource.mint(wallet2.address, toWei('100'));
      await aToken.mock.balanceOf.withArgs(aaveV3YieldSource.address).returns(toWei('100'));

      expect(await aaveV3YieldSource.sharesToToken(toWei('2'))).to.equal(toWei('1'));

      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(ethers.utils.parseUnits('100', 36));
      expect(await aaveV3YieldSource.sharesToToken(2)).to.equal(toWei('1'));
    });
  });

  describe('supplyTokenTo()', () => {
    let amount: BigNumber;
    let tokenAddress: any;

    beforeEach(async () => {
      amount = toWei('100');
      tokenAddress = await aaveV3YieldSource.tokenAddress();
    });

    it('should supply assets if totalSupply is 0', async () => {
      await supplyTokenTo(yieldSourceOwner, amount, amount);
      expect(await aaveV3YieldSource.totalSupply()).to.equal(amount);
    });

    it('should supply assets if totalSupply is not 0', async () => {
      await supplyTokenTo(yieldSourceOwner, amount, amount);
      await supplyTokenTo(wallet2, amount, amount.mul(2));
      expect(await aaveV3YieldSource.totalSupply()).to.equal(amount.add(amount.div(2)));
    });

    it('should revert on error', async () => {
      await pool.mock.deposit
        .withArgs(tokenAddress, amount, aaveV3YieldSource.address, REFERRAL_CODE)
        .reverts();

      await expect(
        aaveV3YieldSource.supplyTokenTo(amount, aaveV3YieldSource.address),
      ).to.be.revertedWith('');
    });
  });

  describe('redeemToken()', () => {
    let yieldSourceOwnerBalance: BigNumber;
    let redeemAmount: BigNumber;

    beforeEach(() => {
      yieldSourceOwnerBalance = toWei('300');
      redeemAmount = toWei('100');
    });

    it('should redeem assets', async () => {
      await supplyTokenTo(yieldSourceOwner, yieldSourceOwnerBalance, yieldSourceOwnerBalance);

      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(yieldSourceOwnerBalance);

      await pool.mock.withdraw
        .withArgs(usdcToken.address, redeemAmount, aaveV3YieldSource.address)
        .returns(redeemAmount);

      await aaveV3YieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount);

      expect(await aaveV3YieldSource.callStatic.balanceOf(yieldSourceOwner.address)).to.equal(
        yieldSourceOwnerBalance.sub(redeemAmount),
      );
    });

    it('should not be able to redeem assets if balance is 0', async () => {
      await expect(
        aaveV3YieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount),
      ).to.be.revertedWith('ERC20: burn amount exceeds balance');
    });

    it('should fail to redeem if amount superior to balance', async () => {
      const yieldSourceOwnerLowBalance = toWei('10');

      await aaveV3YieldSource.mint(yieldSourceOwner.address, yieldSourceOwnerLowBalance);
      await aToken.mock.balanceOf
        .withArgs(aaveV3YieldSource.address)
        .returns(yieldSourceOwnerLowBalance);
      await pool.mock.withdraw
        .withArgs(usdcToken.address, redeemAmount, aaveV3YieldSource.address)
        .returns(redeemAmount);

      await expect(
        aaveV3YieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount),
      ).to.be.revertedWith('ERC20: burn amount exceeds balance');
    });
  });

  describe('claimRewards()', () => {
    const claimAmount = toWei('100');

    beforeEach(async () => {
      await rewardsController.mock.claimAllRewards
        .withArgs([aToken.address], wallet2.address)
        .returns([erc20Token.address], [claimAmount]);
    });

    it('should claimRewards if yieldSourceOwner', async () => {
      await expect(aaveV3YieldSource.connect(yieldSourceOwner).claimRewards(wallet2.address))
        .to.emit(aaveV3YieldSource, 'Claimed')
        .withArgs(yieldSourceOwner.address, wallet2.address, [erc20Token.address], [claimAmount]);
    });

    it('should claimRewards if assetManager', async () => {
      await aaveV3YieldSource.connect(yieldSourceOwner).setManager(wallet2.address);

      await expect(aaveV3YieldSource.connect(wallet2).claimRewards(wallet2.address))
        .to.emit(aaveV3YieldSource, 'Claimed')
        .withArgs(wallet2.address, wallet2.address, [erc20Token.address], [claimAmount]);
    });

    it('should fail to claimRewards if recipient is address zero', async () => {
      await expect(
        aaveV3YieldSource.connect(yieldSourceOwner).claimRewards(AddressZero),
      ).to.be.revertedWith('AaveV3YS/payee-not-zero-address');
    });

    it('should fail to claimRewards if not yieldSourceOwner or assetManager', async () => {
      await expect(
        aaveV3YieldSource.connect(wallet2).claimRewards(wallet2.address),
      ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
    });
  });

  describe('increaseERC20Allowance()', () => {
    it('should increase allowance if yieldSourceOwner', async () => {
      const approveAmount = toWei('10');

      usdcToken.mint(aaveV3YieldSource.address, approveAmount);

      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .increaseERC20Allowance(usdcToken.address, yieldSourceOwner.address, approveAmount);

      usdcToken
        .connect(wallet2)
        .transferFrom(aaveV3YieldSource.address, wallet2.address, approveAmount);
    });

    it('should increase allowance of the underlying asset deposited into the Aave pool', async () => {
      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .decreaseERC20Allowance(usdcToken.address, pool.address, MaxUint256);

      expect(await usdcToken.allowance(aaveV3YieldSource.address, pool.address)).to.equal(
        toWei('0'),
      );

      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .increaseERC20Allowance(usdcToken.address, pool.address, MaxUint256);

      expect(await usdcToken.allowance(aaveV3YieldSource.address, pool.address)).to.equal(
        MaxUint256,
      );
    });

    it('should increase allowance if assetManager', async () => {
      const approveAmount = toWei('10');

      await aaveV3YieldSource.connect(yieldSourceOwner).setManager(wallet2.address);

      usdcToken.mint(aaveV3YieldSource.address, approveAmount);

      await aaveV3YieldSource
        .connect(wallet2)
        .increaseERC20Allowance(usdcToken.address, wallet2.address, approveAmount);

      usdcToken
        .connect(wallet2)
        .transferFrom(aaveV3YieldSource.address, wallet2.address, approveAmount);
    });

    it('should not allow to increase allowance of aToken', async () => {
      await expect(
        aaveV3YieldSource
          .connect(yieldSourceOwner)
          .increaseERC20Allowance(aToken.address, wallet2.address, toWei('10')),
      ).to.be.revertedWith('AaveV3YS/forbid-aToken-allowance');
    });

    it('should fail to increase allowance if not yieldSourceOwner or assetManager', async () => {
      await expect(
        aaveV3YieldSource
          .connect(wallet2)
          .increaseERC20Allowance(usdcToken.address, yieldSourceOwner.address, toWei('10')),
      ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
    });
  });

  describe('decreaseERC20Allowance()', () => {
    beforeEach(async () => {
      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .increaseERC20Allowance(usdcToken.address, wallet2.address, MaxUint256);
    });

    it('should decrease allowance if yieldSourceOwner', async () => {
      usdcToken.mint(aaveV3YieldSource.address, MaxUint256);

      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .decreaseERC20Allowance(usdcToken.address, wallet2.address, MaxUint256);

      await expect(
        usdcToken
          .connect(wallet2)
          .transferFrom(aaveV3YieldSource.address, wallet2.address, MaxUint256),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });

    it('should decrease allowance if assetManager', async () => {
      await aaveV3YieldSource.connect(yieldSourceOwner).setManager(wallet2.address);

      usdcToken.mint(aaveV3YieldSource.address, MaxUint256);

      await aaveV3YieldSource
        .connect(wallet2)
        .decreaseERC20Allowance(usdcToken.address, wallet2.address, MaxUint256);

      await expect(
        usdcToken
          .connect(wallet2)
          .transferFrom(aaveV3YieldSource.address, wallet2.address, MaxUint256),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });

    it('should not allow to decrease allowance of aToken', async () => {
      await expect(
        aaveV3YieldSource
          .connect(yieldSourceOwner)
          .decreaseERC20Allowance(aToken.address, wallet2.address, MaxUint256),
      ).to.be.revertedWith('AaveV3YS/forbid-aToken-allowance');
    });

    it('should fail to decrease allowance if not yieldSourceOwner or assetManager', async () => {
      await expect(
        aaveV3YieldSource
          .connect(wallet2)
          .decreaseERC20Allowance(usdcToken.address, yieldSourceOwner.address, MaxUint256),
      ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
    });
  });

  describe('transferERC20()', () => {
    it('should transferERC20 if yieldSourceOwner', async () => {
      const transferAmount = toWei('10');

      usdcToken.mint(aaveV3YieldSource.address, transferAmount);

      await aaveV3YieldSource
        .connect(yieldSourceOwner)
        .transferERC20(usdcToken.address, wallet2.address, transferAmount);
    });

    it('should transferERC20 if assetManager', async () => {
      const transferAmount = toWei('10');

      usdcToken.mint(aaveV3YieldSource.address, transferAmount);

      await aaveV3YieldSource.connect(yieldSourceOwner).setManager(wallet2.address);

      await aaveV3YieldSource
        .connect(wallet2)
        .transferERC20(usdcToken.address, yieldSourceOwner.address, transferAmount);
    });

    it('should not allow to transfer aToken', async () => {
      await expect(
        aaveV3YieldSource
          .connect(yieldSourceOwner)
          .transferERC20(aToken.address, wallet2.address, toWei('10')),
      ).to.be.revertedWith('AaveV3YS/forbid-aToken-transfer');
    });

    it('should fail to transferERC20 if not yieldSourceOwner or assetManager', async () => {
      await expect(
        aaveV3YieldSource
          .connect(wallet2)
          .transferERC20(usdcToken.address, yieldSourceOwner.address, toWei('10')),
      ).to.be.revertedWith('Manageable/caller-not-manager-or-owner');
    });
  });

  describe('_poolProvider()', () => {
    it('should return Aave PoolAddressesProvider address', async () => {
      const poolAddressesProviderList =
        await poolAddressesProviderRegistry.getAddressesProvidersList();

      expect(await aaveV3YieldSource.poolProvider()).to.equal(poolAddressesProviderList[0]);
    });
  });

  describe('_pool()', () => {
    it('should return Aave Pool address', async () => {
      expect(await aaveV3YieldSource.pool()).to.equal(pool.address);
    });
  });
});
