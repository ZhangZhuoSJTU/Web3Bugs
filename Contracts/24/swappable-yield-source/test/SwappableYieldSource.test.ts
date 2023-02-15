import YieldSourceInterface from '@pooltogether/yield-source-interface/abis/IYieldSource.json';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { MockContract } from 'ethereum-waffle';
import { ethers, waffle } from 'hardhat';

import SafeERC20WrapperUpgradeable from '../abis/SafeERC20WrapperUpgradeable.json';

import { SwappableYieldSourceHarness } from '../types';

describe('SwappableYieldSource', () => {
  let contractsOwner: Signer;
  let yieldSourceOwner: SignerWithAddress;
  let wallet2: SignerWithAddress;

  let yieldSource: MockContract;
  let replacementYieldSource: MockContract;
  let swappableYieldSource: SwappableYieldSourceHarness;

  let erc20Token: MockContract;
  let underlyingToken: MockContract;
  let differentUnderlyingToken: MockContract;

  let isInitializeTest = false;

  const initializeSwappableYieldSource = async (
    yieldSourceAddress: string,
    decimals: number,
    ownerAddress: string,
  ) => {
    await swappableYieldSource.initialize(
      yieldSourceAddress,
      decimals,
      'swsDAI',
      'PoolTogether Swappable Yield Source DAI',
      ownerAddress,
    );
  };

  const { getContractAt, getContractFactory, getSigners, utils } = ethers;
  const { deployMockContract } = waffle;
  const { parseEther: toWei, parseUnits } = utils;

  beforeEach(async () => {
    [contractsOwner, yieldSourceOwner, wallet2] = await getSigners();

    erc20Token = await deployMockContract(contractsOwner, SafeERC20WrapperUpgradeable);

    underlyingToken = await deployMockContract(contractsOwner, SafeERC20WrapperUpgradeable);
    differentUnderlyingToken = await deployMockContract(
      contractsOwner,
      SafeERC20WrapperUpgradeable,
    );

    yieldSource = await deployMockContract(contractsOwner, YieldSourceInterface);
    await yieldSource.mock.depositToken.returns(underlyingToken.address);

    replacementYieldSource = await deployMockContract(contractsOwner, YieldSourceInterface);
    await replacementYieldSource.mock.depositToken.returns(underlyingToken.address);

    const SwappableYieldSource = await getContractFactory('SwappableYieldSourceHarness');
    const hardhatSwappableYieldSourceHarness = await SwappableYieldSource.deploy();

    swappableYieldSource = (await getContractAt(
      'SwappableYieldSourceHarness',
      hardhatSwappableYieldSourceHarness.address,
      contractsOwner,
    )) as SwappableYieldSourceHarness;

    await underlyingToken.mock.allowance
      .withArgs(swappableYieldSource.address, yieldSource.address)
      .returns(ethers.constants.Zero);

    await underlyingToken.mock.approve
      .withArgs(yieldSource.address, ethers.constants.MaxUint256)
      .returns(true);

    if (!isInitializeTest) {
      await initializeSwappableYieldSource(yieldSource.address, 18, yieldSourceOwner.address);
    }
  });

  describe('initialize()', () => {
    before(() => {
      isInitializeTest = true;
    });

    after(() => {
      isInitializeTest = false;
    });

    it('should fail if yieldSource is address zero', async () => {
      await expect(
        initializeSwappableYieldSource(ethers.constants.AddressZero, 18, yieldSourceOwner.address),
      ).to.be.revertedWith('SwappableYieldSource/yieldSource-not-zero-address');
    });

    it('should fail if yieldSource address is not a yield source', async () => {
      const randomWallet = ethers.Wallet.createRandom();

      await expect(
        initializeSwappableYieldSource(randomWallet.address, 18, yieldSourceOwner.address),
      ).to.be.revertedWith('SwappableYieldSource/invalid-yield-source');
    });

    it('should fail if yieldSource depositToken is address zero', async () => {
      await yieldSource.mock.depositToken.returns(ethers.constants.AddressZero);

      await expect(
        initializeSwappableYieldSource(yieldSource.address, 18, yieldSourceOwner.address),
      ).to.be.revertedWith('SwappableYieldSource/invalid-yield-source');
    });

    it('should fail if owner is address zero', async () => {
      await expect(
        initializeSwappableYieldSource(yieldSource.address, 18, ethers.constants.AddressZero),
      ).to.be.revertedWith('SwappableYieldSource/owner-not-zero-address');
    });

    it('should fail if token decimal is not greater than 0', async () => {
      await expect(
        initializeSwappableYieldSource(yieldSource.address, 0, yieldSourceOwner.address),
      ).to.be.revertedWith('SwappableYieldSource/decimals-gt-zero');
    });
  });

  describe('create()', () => {
    it('should create SwappableYieldSource', async () => {
      expect(await swappableYieldSource.yieldSource()).to.equal(yieldSource.address);
      expect(await swappableYieldSource.owner()).to.equal(yieldSourceOwner.address);
    });
  });

  describe('assetManager()', () => {
    it('should setAssetManager', async () => {
      await expect(swappableYieldSource.connect(yieldSourceOwner).setAssetManager(wallet2.address))
        .to.emit(swappableYieldSource, 'AssetManagerTransferred')
        .withArgs(ethers.constants.AddressZero, wallet2.address);

      expect(await swappableYieldSource.assetManager()).to.equal(wallet2.address);
    });

    it('should fail to setAssetManager', async () => {
      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .setAssetManager(ethers.constants.AddressZero),
      ).to.be.revertedWith('onlyOwnerOrAssetManager/assetManager-not-zero-address');
    });
  });

  describe('approveMaxAmount()', () => {
    it('should approve yieldSource to spend max uint256 amount', async () => {
      await underlyingToken.mock.allowance
        .withArgs(swappableYieldSource.address, yieldSource.address)
        .returns(ethers.constants.MaxUint256);

      expect(
        await swappableYieldSource.connect(yieldSourceOwner).callStatic.approveMaxAmount(),
      ).to.equal(true);
      expect(
        await underlyingToken.allowance(swappableYieldSource.address, yieldSource.address),
      ).to.equal(ethers.constants.MaxUint256);
    });

    it('should fail if not owner', async () => {
      await expect(
        swappableYieldSource.connect(wallet2).callStatic.approveMaxAmount(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('depositToken()', () => {
    it('should return the underlying token', async () => {
      expect(await swappableYieldSource.depositToken()).to.equal(underlyingToken.address);
    });
  });

  describe('balanceOfToken()', () => {
    it('should return user balance', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('1000'));

      expect(await swappableYieldSource.callStatic.balanceOfToken(wallet2.address)).to.equal(
        toWei('500'),
      );
    });
  });

  describe('_tokenToShares()', () => {
    it('should return shares amount', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('1000'));

      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('10'))).to.equal(toWei('2'));
    });

    it('should return 0 if tokens param is 0', async () => {
      expect(await swappableYieldSource.callStatic.tokenToShares('0')).to.equal('0');
    });

    it('should return tokens if totalSupply is 0', async () => {
      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('100'))).to.equal(
        toWei('100'),
      );
    });

    it('should return shares even if yield source total supply has a lot of decimals', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('1'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('0.000000000000000005'));

      expect(
        await swappableYieldSource.callStatic.tokenToShares(toWei('0.000000000000000005')),
      ).to.equal(toWei('1'));
    });

    it('should return shares even if yield source total supply increases', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('100'));

      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('1'))).to.equal(toWei('2'));

      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(parseUnits('100', 36));

      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('1'))).to.equal(2);
    });

    it('should fail to return shares if yield source total supply increases too much', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('100'));

      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('1'))).to.equal(toWei('2'));

      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(parseUnits('100', 37));

      expect(await swappableYieldSource.callStatic.tokenToShares(toWei('1'))).to.equal(0);
    });
  });

  describe('_sharesToToken()', () => {
    it('should return tokens amount', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('1000'));

      expect(await swappableYieldSource.callStatic.sharesToToken(toWei('2'))).to.equal(toWei('10'));
    });

    it('should return shares if totalSupply is 0', async () => {
      expect(await swappableYieldSource.callStatic.sharesToToken(toWei('100'))).to.equal(
        toWei('100'),
      );
    });

    it('should return tokens even if totalSupply has a lot of decimals', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('0.000000000000000005'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('100'));

      expect(
        await swappableYieldSource.callStatic.sharesToToken(toWei('0.000000000000000005')),
      ).to.equal(toWei('100'));
    });

    it('should return tokens even if yield source total supply increases', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(toWei('100'));

      expect(await swappableYieldSource.callStatic.sharesToToken(toWei('2'))).to.equal(toWei('1'));

      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(parseUnits('100', 36));

      expect(await swappableYieldSource.callStatic.sharesToToken(2)).to.equal(toWei('1'));
    });
  });

  const supplyTokenTo = async (userAmount: BigNumber, user: SignerWithAddress) => {
    const userAddress = user.address;

    await underlyingToken.mock.balanceOf.withArgs(yieldSourceOwner.address).returns(toWei('200'));
    await yieldSource.mock.balanceOfToken
      .withArgs(swappableYieldSource.address)
      .returns(toWei('300'));

    await underlyingToken.mock.transferFrom
      .withArgs(userAddress, swappableYieldSource.address, userAmount)
      .returns(true);

    await yieldSource.mock.supplyTokenTo
      .withArgs(userAmount, swappableYieldSource.address)
      .returns();

    await swappableYieldSource.connect(user).supplyTokenTo(userAmount, userAddress);
  };

  describe('supplyTokenTo()', () => {
    let amount: BigNumber;

    beforeEach(async () => {
      amount = toWei('100');
    });

    it('should supply assets if totalSupply is 0', async () => {
      await supplyTokenTo(amount, yieldSourceOwner);
      expect(await swappableYieldSource.totalSupply()).to.equal(amount);
    });

    it('should supply assets if totalSupply is not 0', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('100'));
      await swappableYieldSource.mint(wallet2.address, toWei('100'));
      await supplyTokenTo(amount, yieldSourceOwner);
    });

    it('should revert on error', async () => {
      await expect(
        swappableYieldSource.supplyTokenTo(amount, swappableYieldSource.address),
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
      await swappableYieldSource.mint(yieldSourceOwner.address, yieldSourceOwnerBalance);
      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(yieldSourceOwnerBalance);

      const balanceDiff = yieldSourceOwnerBalance.sub(redeemAmount);
      await yieldSource.mock.redeemToken.withArgs(redeemAmount).returns(balanceDiff);

      await underlyingToken.mock.transferFrom
        .withArgs(swappableYieldSource.address, yieldSourceOwner.address, balanceDiff)
        .returns(true);

      await swappableYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount);

      expect(await swappableYieldSource.totalSupply()).to.equal(balanceDiff);
    });

    it('should not be able to redeem assets if balance is 0', async () => {
      await swappableYieldSource.mint(yieldSourceOwner.address, toWei('0'));

      await expect(
        swappableYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount),
      ).to.be.revertedWith('ERC20: burn amount exceeds balance');
    });

    it('should fail to redeem if amount superior to balance', async () => {
      const yieldSourceOwnerLowBalance = toWei('10');
      const revertReason = 'ERC20: burn amount exceeds balance';

      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(yieldSourceOwnerLowBalance);

      await yieldSource.mock.redeemToken.withArgs(redeemAmount).revertsWithReason(revertReason);

      await expect(
        swappableYieldSource.connect(yieldSourceOwner).redeemToken(redeemAmount),
      ).to.be.revertedWith(revertReason);
    });
  });

  describe('setYieldSource()', () => {
    beforeEach(async () => {
      await underlyingToken.mock.allowance
        .withArgs(swappableYieldSource.address, replacementYieldSource.address)
        .returns(ethers.constants.Zero);

      await underlyingToken.mock.approve
        .withArgs(replacementYieldSource.address, ethers.constants.MaxUint256)
        .returns(true);
    });

    it('should setYieldSource if yieldSourceOwner', async () => {
      expect(
        await swappableYieldSource
          .connect(yieldSourceOwner)
          .setYieldSource(replacementYieldSource.address),
      ).to.emit(swappableYieldSource, 'SwappableYieldSourceSet');

      expect(await swappableYieldSource.yieldSource()).to.equal(replacementYieldSource.address);
    });

    it('should setYieldSource if assetManager', async () => {
      await expect(swappableYieldSource.connect(yieldSourceOwner).setAssetManager(wallet2.address))
        .to.emit(swappableYieldSource, 'AssetManagerTransferred')
        .withArgs(ethers.constants.AddressZero, wallet2.address);

      expect(
        await swappableYieldSource.connect(wallet2).setYieldSource(replacementYieldSource.address),
      ).to.emit(swappableYieldSource, 'SwappableYieldSourceSet');

      expect(await swappableYieldSource.yieldSource()).to.equal(replacementYieldSource.address);
    });

    it('should fail to setYieldSource if not yieldSourceOwner or assetManager', async () => {
      await expect(
        swappableYieldSource.connect(wallet2).setYieldSource(replacementYieldSource.address),
      ).to.be.revertedWith('onlyOwnerOrAssetManager/owner-or-manager');
    });

    it('should fail to setYieldSource if same yield source', async () => {
      await expect(
        swappableYieldSource.connect(yieldSourceOwner).setYieldSource(yieldSource.address),
      ).to.be.revertedWith('SwappableYieldSource/same-yield-source');
    });

    it('should fail to setYieldSource if depositToken is different', async () => {
      await replacementYieldSource.mock.depositToken.returns(differentUnderlyingToken.address);

      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .setYieldSource(replacementYieldSource.address),
      ).to.be.revertedWith('SwappableYieldSource/different-deposit-token');
    });
  });

  describe('transferFunds()', () => {
    let yieldSourceBalance: BigNumber;
    let replacementYieldSourceBalance: BigNumber;

    beforeEach(() => {
      yieldSourceBalance = toWei('300');
      replacementYieldSourceBalance = toWei('600');
    });

    it('should transferFunds', async () => {
      await replacementYieldSource.mock.redeemToken
        .withArgs(replacementYieldSourceBalance)
        .returns(replacementYieldSourceBalance);

      await underlyingToken.mock.balanceOf
        .withArgs(swappableYieldSource.address)
        .returns(replacementYieldSourceBalance);

      await underlyingToken.mock.allowance
        .withArgs(swappableYieldSource.address, yieldSource.address)
        .returns(toWei('0'));

      await underlyingToken.mock.approve
        .withArgs(yieldSource.address, replacementYieldSourceBalance)
        .returns(true);

      await yieldSource.mock.supplyTokenTo
        .withArgs(replacementYieldSourceBalance, swappableYieldSource.address)
        .returns();

      expect(
        await swappableYieldSource
          .connect(yieldSourceOwner)
          .transferFunds(replacementYieldSource.address, replacementYieldSourceBalance),
      ).to.emit(swappableYieldSource, 'FundsTransferred');
    });

    it('should transferFunds if assetManager', async () => {
      await replacementYieldSource.mock.redeemToken
        .withArgs(replacementYieldSourceBalance)
        .returns(replacementYieldSourceBalance);

      await underlyingToken.mock.balanceOf
        .withArgs(swappableYieldSource.address)
        .returns(replacementYieldSourceBalance);

      await underlyingToken.mock.allowance
        .withArgs(swappableYieldSource.address, yieldSource.address)
        .returns(toWei('0'));

      await underlyingToken.mock.approve
        .withArgs(yieldSource.address, replacementYieldSourceBalance)
        .returns(true);

      await yieldSource.mock.supplyTokenTo
        .withArgs(replacementYieldSourceBalance, swappableYieldSource.address)
        .returns();

      swappableYieldSource.connect(yieldSourceOwner).setAssetManager(wallet2.address);

      expect(
        await swappableYieldSource
          .connect(wallet2)
          .transferFunds(replacementYieldSource.address, replacementYieldSourceBalance),
      ).to.emit(swappableYieldSource, 'FundsTransferred');
    });

    it('should fail to transferFunds if balanceDiff different from amount', async () => {
      const differentAmount = toWei('200');

      await replacementYieldSource.mock.redeemToken
        .withArgs(replacementYieldSourceBalance)
        .returns(differentAmount);

      await underlyingToken.mock.balanceOf
        .withArgs(swappableYieldSource.address)
        .returns(differentAmount);

      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .transferFunds(replacementYieldSource.address, replacementYieldSourceBalance),
      ).to.be.revertedWith('SwappableYieldSource/transfer-amount-different');
    });

    it('should fail to transferFunds if same yield source', async () => {
      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .transferFunds(yieldSource.address, yieldSourceBalance),
      ).to.be.revertedWith('SwappableYieldSource/same-yield-source');
    });

    it('should fail to transferFunds if not owner or asset manager', async () => {
      await expect(
        swappableYieldSource
          .connect(wallet2)
          .transferFunds(yieldSource.address, yieldSourceBalance),
      ).to.be.revertedWith('onlyOwnerOrAssetManager/owner-or-manager');
    });
  });

  describe('swapYieldSource()', () => {
    let yieldSourceBalance: BigNumber;
    let replacementYieldSourceBalance: BigNumber;

    beforeEach(async () => {
      yieldSourceBalance = toWei('300');
      replacementYieldSourceBalance = toWei('600');

      await yieldSource.mock.balanceOfToken
        .withArgs(swappableYieldSource.address)
        .returns(yieldSourceBalance);

      await yieldSource.mock.redeemToken.withArgs(yieldSourceBalance).returns(yieldSourceBalance);

      await underlyingToken.mock.balanceOf
        .withArgs(swappableYieldSource.address)
        .returns(yieldSourceBalance);

      await underlyingToken.mock.allowance
        .withArgs(swappableYieldSource.address, replacementYieldSource.address)
        .returns(ethers.constants.Zero);

      await underlyingToken.mock.approve
        .withArgs(replacementYieldSource.address, ethers.constants.MaxUint256)
        .returns(true);

      await replacementYieldSource.mock.supplyTokenTo
        .withArgs(yieldSourceBalance, swappableYieldSource.address)
        .returns();
    });

    it('should swapYieldSource if yieldSourceOwner', async () => {
      const transaction = await swappableYieldSource
        .connect(yieldSourceOwner)
        .swapYieldSource(replacementYieldSource.address);

      expect(transaction)
        .to.emit(swappableYieldSource, 'SwappableYieldSourceSet')
        .withArgs(replacementYieldSource.address);

      expect(transaction)
        .to.emit(swappableYieldSource, 'FundsTransferred')
        .withArgs(yieldSource.address, yieldSourceBalance);

      expect(await swappableYieldSource.yieldSource()).to.equal(replacementYieldSource.address);
    });

    it('should swapYieldSource if assetManager', async () => {
      await expect(
        swappableYieldSource.connect(yieldSourceOwner).setAssetManager(wallet2.address),
      ).to.emit(swappableYieldSource, 'AssetManagerTransferred');

      const transaction = await swappableYieldSource
        .connect(wallet2)
        .swapYieldSource(replacementYieldSource.address);

      expect(transaction)
        .to.emit(swappableYieldSource, 'SwappableYieldSourceSet')
        .withArgs(replacementYieldSource.address);

      expect(transaction)
        .to.emit(swappableYieldSource, 'FundsTransferred')
        .withArgs(yieldSource.address, yieldSourceBalance);

      expect(await swappableYieldSource.yieldSource()).to.equal(replacementYieldSource.address);
    });

    it('should fail to swapYieldSource if not yieldSourceOwner or assetManager', async () => {
      await expect(
        swappableYieldSource.connect(wallet2).swapYieldSource(yieldSource.address),
      ).to.be.revertedWith('onlyOwnerOrAssetManager/owner-or-manager');
    });
  });

  describe('transferERC20()', () => {
    it('should transferERC20 if yieldSourceOwner', async () => {
      const transferAmount = toWei('10');

      await erc20Token.mock.transfer.withArgs(wallet2.address, transferAmount).returns(true);

      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .transferERC20(erc20Token.address, wallet2.address, transferAmount),
      ).to.emit(swappableYieldSource, 'TransferredERC20');
    });

    it('should transferERC20 if assetManager', async () => {
      const transferAmount = toWei('10');

      await erc20Token.mock.transfer
        .withArgs(yieldSourceOwner.address, transferAmount)
        .returns(true);

      await expect(
        swappableYieldSource.connect(yieldSourceOwner).setAssetManager(wallet2.address),
      ).to.emit(swappableYieldSource, 'AssetManagerTransferred');

      await expect(
        swappableYieldSource
          .connect(wallet2)
          .transferERC20(erc20Token.address, yieldSourceOwner.address, transferAmount),
      ).to.emit(swappableYieldSource, 'TransferredERC20');
    });

    it('should not allow to transfer yield source token', async () => {
      await expect(
        swappableYieldSource
          .connect(yieldSourceOwner)
          .transferERC20(yieldSource.address, wallet2.address, toWei('10')),
      ).to.be.revertedWith('SwappableYieldSource/yield-source-token-transfer-not-allowed');
    });

    it('should fail to transferERC20 if not yieldSourceOwner or assetManager', async () => {
      await expect(
        swappableYieldSource
          .connect(wallet2)
          .transferERC20(erc20Token.address, yieldSourceOwner.address, toWei('10')),
      ).to.be.revertedWith('onlyOwnerOrAssetManager/owner-or-manager');
    });
  });
});
