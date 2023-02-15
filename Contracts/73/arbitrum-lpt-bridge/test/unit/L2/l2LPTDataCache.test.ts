import {smock} from '@defi-wonderland/smock';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';
import {ethers} from 'hardhat';
import {L2LPTDataCache, L2LPTDataCache__factory} from '../../../typechain';
import {getL2SignerFromL1} from '../../utils/messaging';

use(smock.matchers);

describe('L2LPTDataCache', () => {
  let l2LPTDataCache: L2LPTDataCache;

  let deployer: SignerWithAddress;
  let notDeployer: SignerWithAddress;

  let mockL1LPTDataCacheEOA: SignerWithAddress;
  let mockL1LPTDataCacheL2AliasEOA: SignerWithAddress;
  let mockL2LPTGatewayEOA: SignerWithAddress;

  beforeEach(async function() {
    [deployer, notDeployer, mockL1LPTDataCacheEOA, mockL2LPTGatewayEOA] =
      await ethers.getSigners();

    const L2LPTDataCache: L2LPTDataCache__factory =
      await ethers.getContractFactory('L2LPTDataCache');
    l2LPTDataCache = await L2LPTDataCache.deploy();
    await l2LPTDataCache.deployed();

    await l2LPTDataCache.setL1LPTDataCache(mockL1LPTDataCacheEOA.address);
    await l2LPTDataCache.setL2LPTGateway(mockL2LPTGatewayEOA.address);

    mockL1LPTDataCacheL2AliasEOA = await getL2SignerFromL1(
        mockL1LPTDataCacheEOA,
    );
    await mockL1LPTDataCacheEOA.sendTransaction({
      to: mockL1LPTDataCacheL2AliasEOA.address,
      value: ethers.utils.parseUnits('1', 'ether'),
    });
  });

  describe('constructor', () => {
    it('sets owner to deployer', async () => {
      expect(await l2LPTDataCache.owner()).to.be.equal(deployer.address);
    });
  });

  describe('setL1LPTDataCache', () => {
    it('reverts if msg.sender != owner', async () => {
      await expect(
          l2LPTDataCache
              .connect(notDeployer)
              .setL1LPTDataCache(ethers.constants.AddressZero),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets L1LPTDataCache', async () => {
      await l2LPTDataCache.setL1LPTDataCache(ethers.constants.AddressZero);
      expect(await l2LPTDataCache.l1LPTDataCache()).to.be.equal(
          ethers.constants.AddressZero,
      );
    });
  });

  describe('setL2LPTGateway', () => {
    it('reverts if msg.sender != owner', async () => {
      await expect(
          l2LPTDataCache
              .connect(notDeployer)
              .setL2LPTGateway(ethers.constants.AddressZero),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets L2LPTGateway', async () => {
      await l2LPTDataCache.setL2LPTGateway(ethers.constants.AddressZero);
      expect(await l2LPTDataCache.l2LPTGateway()).to.be.equal(
          ethers.constants.AddressZero,
      );
    });
  });

  describe('increaseL2SupplyFromL1', () => {
    it('reverts if msg.sender != L2LPTGateway', async () => {
      await expect(l2LPTDataCache.increaseL2SupplyFromL1(1)).to.be.revertedWith(
          'NOT_L2_LPT_GATEWAY',
      );
    });

    it('increases l2SupplyFromL1 by specified amount', async () => {
      const amount0 = 100;
      const amount1 = 200;

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(amount0);
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(amount0);

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(amount1);
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(
          amount0 + amount1,
      );
    });
  });

  describe('decreaseL2SupplyFromL1', () => {
    it('reverts if msg.sender != L2LPTGateway', async () => {
      await expect(l2LPTDataCache.decreaseL2SupplyFromL1(1)).to.be.revertedWith(
          'NOT_L2_LPT_GATEWAY',
      );
    });

    it('sets l2SupplyFromL1 to 0 if amount > l2SupplyFromL1', async () => {
      // l2SupplyFromL1 = 0
      await expect(
          l2LPTDataCache.connect(mockL2LPTGatewayEOA).decreaseL2SupplyFromL1(100),
      ).to.not.be.reverted;
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(0);

      // l2SupplyFromL1 > 0
      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(99);
      await expect(
          l2LPTDataCache.connect(mockL2LPTGatewayEOA).decreaseL2SupplyFromL1(100),
      ).to.not.be.reverted;
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(0);
    });

    it('decreases l2SupplyFromL1 by specified amount', async () => {
      const initAmount = 1000;
      const amount0 = 100;
      const amount1 = 200;

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(initAmount);
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(initAmount);

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .decreaseL2SupplyFromL1(amount0);
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(
          initAmount - amount0,
      );

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .decreaseL2SupplyFromL1(amount1);
      expect(await l2LPTDataCache.l2SupplyFromL1()).to.be.equal(
          initAmount - amount0 - amount1,
      );
    });
  });

  describe('finalizeCacheTotalSupply', () => {
    it('reverts if msg.sender != L1LPTDataCache L2 alias', async () => {
      // msg.sender = some invalid address
      await expect(
          l2LPTDataCache.finalizeCacheTotalSupply(100),
      ).to.be.revertedWith('ONLY_COUNTERPART_GATEWAY');

      // msg.sender = L1LPTDataCache (no alias)
      await expect(
          l2LPTDataCache
              .connect(mockL1LPTDataCacheEOA)
              .finalizeCacheTotalSupply(100),
      ).to.be.revertedWith('ONLY_COUNTERPART_GATEWAY');
    });

    it('caches total supply', async () => {
      const totalSupply0 = 100;
      const totalSupply1 = 200;

      let tx = await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(totalSupply0);
      expect(await l2LPTDataCache.l1TotalSupply()).to.be.equal(totalSupply0);
      await expect(tx)
          .to.emit(l2LPTDataCache, 'CacheTotalSupplyFinalized')
          .withArgs(totalSupply0);

      tx = await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(totalSupply1);
      expect(await l2LPTDataCache.l1TotalSupply()).to.be.equal(totalSupply1);
      await expect(tx)
          .to.emit(l2LPTDataCache, 'CacheTotalSupplyFinalized')
          .withArgs(totalSupply1);
    });
  });

  describe('l1CirculatingSupply', () => {
    it('returns 0 if l1TotalSupply == l2SupplyFromL1', async () => {
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(0);
    });

    it('returns 0 if l1TotalSupply < l2SupplyFromL1', async () => {
      // l1TotalSupply = 0
      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(100);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(0);

      // l1TotalSupply > 0
      await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(50);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(0);
    });

    it('calculates and returns L1 circulating supply', async () => {
      const l1TotalSupply = 100;
      const l2SupplyFromL1 = 50;

      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(l2SupplyFromL1);
      await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(l1TotalSupply);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(
          l1TotalSupply - l2SupplyFromL1,
      );

      // Increase l2SupplyFromL1 -> decrease circulating supply
      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .increaseL2SupplyFromL1(1);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(
          l1TotalSupply - l2SupplyFromL1 - 1,
      );

      // Decrease l2SupplyFromL1 -> increase circulating supply
      await l2LPTDataCache
          .connect(mockL2LPTGatewayEOA)
          .decreaseL2SupplyFromL1(1);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(
          l1TotalSupply - l2SupplyFromL1,
      );

      // Increase l1TotalSupply -> increase circulating supply
      await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(l1TotalSupply + 1);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(
          l1TotalSupply - l2SupplyFromL1 + 1,
      );

      // Decrease l1TotalSupply -> decrease circulating supply
      await l2LPTDataCache
          .connect(mockL1LPTDataCacheL2AliasEOA)
          .finalizeCacheTotalSupply(l1TotalSupply);
      expect(await l2LPTDataCache.l1CirculatingSupply()).to.be.equal(
          l1TotalSupply - l2SupplyFromL1,
      );
    });
  });
});
