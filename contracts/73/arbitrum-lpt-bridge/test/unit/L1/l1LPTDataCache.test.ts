import {FakeContract, smock} from '@defi-wonderland/smock';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';
import {ethers} from 'hardhat';
import {
  IL2LPTDataCache__factory,
  L1LPTDataCache,
  L1LPTDataCache__factory,
} from '../../../typechain';

use(smock.matchers);

describe('L1LPTDataCache', () => {
  let l1LPTDataCache: L1LPTDataCache;

  let l1EOA: SignerWithAddress;

  let inboxMock: FakeContract;
  let outboxMock: FakeContract;
  let bridgeMock: FakeContract;
  let tokenMock: FakeContract;
  let mockInboxEOA: SignerWithAddress;
  let mockOutboxEOA: SignerWithAddress;
  let mockBridgeEOA: SignerWithAddress;
  let mockTokenEOA: SignerWithAddress;
  let mockL2LPTDataCacheEOA: SignerWithAddress;

  beforeEach(async function() {
    [
      l1EOA,
      mockInboxEOA,
      mockOutboxEOA,
      mockBridgeEOA,
      mockTokenEOA,
      mockL2LPTDataCacheEOA,
    ] = await ethers.getSigners();

    const L1LPTDataCache: L1LPTDataCache__factory =
      await ethers.getContractFactory('L1LPTDataCache');
    l1LPTDataCache = await L1LPTDataCache.deploy(
        mockInboxEOA.address,
        mockTokenEOA.address,
        mockL2LPTDataCacheEOA.address,
    );
    await l1LPTDataCache.deployed();

    inboxMock = await smock.fake('IInbox', {
      address: mockInboxEOA.address,
    });

    outboxMock = await smock.fake('IOutbox', {
      address: mockOutboxEOA.address,
    });

    bridgeMock = await smock.fake('IBridge', {
      address: mockBridgeEOA.address,
    });

    tokenMock = await smock.fake('TotalSupplyLike', {
      address: mockTokenEOA.address,
    });

    inboxMock.bridge.returns(bridgeMock.address);
    bridgeMock.activeOutbox.returns(outboxMock.address);
  });

  describe('constructor', () => {
    it('sets addresses', async () => {
      expect(await l1LPTDataCache.inbox()).to.be.equal(mockInboxEOA.address);
      expect(await l1LPTDataCache.tokenAddr()).to.be.equal(
          mockTokenEOA.address,
      );
      expect(await l1LPTDataCache.l2LPTDataCacheAddr()).to.be.equal(
          mockL2LPTDataCacheEOA.address,
      );
    });
  });

  describe('cacheTotalSupply', () => {
    it('sends retryable ticket', async () => {
      const seqNo = 7;
      const totalSupply = 1000;

      inboxMock.createRetryableTicket.returns(seqNo);
      tokenMock.totalSupply.returns(totalSupply);

      const maxGas = 111;
      const gasPriceBid = 222;
      const maxSubmissionCost = 333;
      const l1CallValue = 444;

      const l2Calldata =
        IL2LPTDataCache__factory.createInterface().encodeFunctionData(
            'finalizeCacheTotalSupply',
            [totalSupply],
        );

      const tx = await l1LPTDataCache
          .connect(l1EOA)
          .cacheTotalSupply(maxGas, gasPriceBid, maxSubmissionCost, {
            value: l1CallValue,
          });

      expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
          mockL2LPTDataCacheEOA.address,
          0,
          maxSubmissionCost,
          l1EOA.address,
          l1EOA.address,
          maxGas,
          gasPriceBid,
          l2Calldata,
      );
      await expect(tx)
          .to.emit(l1LPTDataCache, 'CacheTotalSupplyInitiated')
          .withArgs(seqNo, totalSupply);
    });
  });

  describe('getCacheTotalSupplyData', () => {
    it('returns L2 calldata and total supply', async () => {
      const totalSupply = 1000;

      tokenMock.totalSupply.returns(totalSupply);

      const l2Calldata =
        IL2LPTDataCache__factory.createInterface().encodeFunctionData(
            'finalizeCacheTotalSupply',
            [totalSupply],
        );

      const res = await l1LPTDataCache.getCacheTotalSupplyData();
      expect(res.data).to.be.equal(l2Calldata);
      expect(res.totalSupply).to.be.equal(totalSupply);
    });
  });
});
