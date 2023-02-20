import {Signer} from '@ethersproject/abstract-signer';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';
import {ethers} from 'hardhat';
import {
  L1LPTGateway__factory,
  L2LPTGateway,
  L2LPTGateway__factory,
  LivepeerToken,
  LivepeerToken__factory,
} from '../../../typechain';
import {getL2SignerFromL1} from '../../utils/messaging';
import {FakeContract, smock} from '@defi-wonderland/smock';

use(smock.matchers);

describe('L2 Gateway', function() {
  let token: LivepeerToken;
  let owner: SignerWithAddress;
  let l2Gateway: L2LPTGateway;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let governor: SignerWithAddress;

  // mocks
  let arbSysMock: FakeContract;
  let l2LPTDataCacheMock: FakeContract;
  let mockL2RouterEOA: SignerWithAddress;
  let mockL1GatewayEOA: SignerWithAddress;
  let mockL1GatewayL2Alias: Signer;
  let mockL1LptEOA: SignerWithAddress;
  let mockL2LPTDataCacheEOA: SignerWithAddress;

  const BURNER_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['BURNER_ROLE'],
  );

  const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['GOVERNOR_ROLE'],
  );

  beforeEach(async function() {
    [
      owner,
      sender,
      receiver,
      governor,
      mockL2RouterEOA,
      mockL1GatewayEOA,
      mockL1LptEOA,
      mockL2LPTDataCacheEOA,
    ] = await ethers.getSigners();

    const Token: LivepeerToken__factory = await ethers.getContractFactory(
        'LivepeerToken',
    );
    token = await Token.deploy();
    await token.deployed();

    const L2Gateway: L2LPTGateway__factory = await ethers.getContractFactory(
        'L2LPTGateway',
    );
    l2Gateway = await L2Gateway.deploy(
        mockL2RouterEOA.address,
        mockL1LptEOA.address,
        token.address,
        mockL2LPTDataCacheEOA.address,
    );
    await l2Gateway.deployed();

    await token.grantRole(
        ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
        l2Gateway.address,
    );

    await l2Gateway.grantRole(GOVERNOR_ROLE, governor.address);
    await l2Gateway.connect(governor).setCounterpart(mockL1GatewayEOA.address);

    await token.grantRole(BURNER_ROLE, l2Gateway.address);

    mockL1GatewayL2Alias = await getL2SignerFromL1(mockL1GatewayEOA);
    await owner.sendTransaction({
      to: await mockL1GatewayL2Alias.getAddress(),
      value: ethers.utils.parseUnits('1', 'ether'),
    });

    arbSysMock = await smock.fake('IArbSys', {
      address: '0x0000000000000000000000000000000000000064',
    });

    l2LPTDataCacheMock = await smock.fake(
        'contracts/L2/gateway/L2LPTGateway.sol:IL2LPTDataCache',
        {
          address: mockL2LPTDataCacheEOA.address,
        },
    );
  });

  describe('constructor', () => {
    it('sets addresses', async () => {
      expect(await l2Gateway.l2Router()).to.be.equal(mockL2RouterEOA.address);
      expect(await l2Gateway.l2LPTDataCache()).to.be.equal(
          mockL2LPTDataCacheEOA.address,
      );
    });

    describe('l2 token', () => {
      it('should return correct l2 token', async function() {
        const lpt = await l2Gateway.calculateL2TokenAddress(
            mockL1LptEOA.address,
        );
        expect(lpt).to.equal(token.address);
      });

      // eslint-disable-next-line
      it('should return 0 address when called with incorrect l1 token', async function () {
        const lpt = await l2Gateway.calculateL2TokenAddress(
            ethers.utils.hexlify(ethers.utils.randomBytes(20)),
        );
        expect(lpt).to.equal('0x0000000000000000000000000000000000000000');
      });
    });

    describe('l1 counterpart', () => {
      it('should return correct l1 counterpart', async function() {
        const counterpart = await l2Gateway.counterpartGateway();
        expect(counterpart).to.equal(mockL1GatewayEOA.address);
      });
    });
  });

  describe('setCounterpart', () => {
    const newAddress = ethers.utils.getAddress(
        ethers.utils.solidityKeccak256(['string'], ['newAddress']).slice(0, 42),
    );

    describe('caller not governor', () => {
      it('should fail to change counterpart address', async function() {
        const tx = l2Gateway.connect(owner).setCounterpart(newAddress);
        expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${GOVERNOR_ROLE}`
        );
      });
    });

    describe('caller is governor', () => {
      it('should change counterpart address', async function() {
        await l2Gateway.connect(governor).setCounterpart(newAddress);
        const counterpart = await l2Gateway.counterpartGateway();
        expect(counterpart).to.equal(newAddress);
      });
    });
  });

  describe('finalizeInboundTransfer', () => {
    const depositAmount = 100;
    const defaultData = ethers.utils.defaultAbiCoder.encode(
        ['bytes', 'bytes'],
        ['0x12', '0x'],
    );

    describe('when gateway is not paused', () => {
      describe('caller is not l1 gateway router (aliased)', () => {
        it('should revert if not relaying message from l1Gateway', async () => {
          const tx = l2Gateway
              .connect(owner)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  sender.address,
                  depositAmount,
                  defaultData,
              );

          await expect(tx).to.be.revertedWith('ONLY_COUNTERPART_GATEWAY');
        });

        it('should revert when called directly by l1 counterpart', async () => {
          // this should fail b/c we require address translation
          const tx = l2Gateway
              .connect(mockL1GatewayEOA)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  sender.address,
                  depositAmount,
                  defaultData,
              );

          await expect(tx).to.be.revertedWith('ONLY_COUNTERPART_GATEWAY');
        });
      });

      describe('caller is l1 gateway router (aliased)', () => {
        it('should revert when withdrawing not supported tokens', async () => {
          const tx = l2Gateway
              .connect(mockL1GatewayL2Alias)
              .finalizeInboundTransfer(
                  ethers.utils.hexlify(ethers.utils.randomBytes(20)),
                  sender.address,
                  sender.address,
                  depositAmount,
                  defaultData,
              );
          await expect(tx).to.be.revertedWith('TOKEN_NOT_LPT');
        });

        it('should revert when DAI minting access was revoked', async () => {
          const MINTER_ROLE = ethers.utils.solidityKeccak256(
              ['string'],
              ['MINTER_ROLE'],
          );
          await token.revokeRole(MINTER_ROLE, l2Gateway.address);

          const tx = l2Gateway
              .connect(mockL1GatewayL2Alias)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  sender.address,
                  depositAmount,
                  defaultData,
              );

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${l2Gateway.address.toLowerCase()} is missing role ${MINTER_ROLE}`
          );
        });

        it('mints tokens', async () => {
          const tx = await l2Gateway
              .connect(mockL1GatewayL2Alias)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  sender.address,
                  depositAmount,
                  defaultData,
              );

          expect(await token.balanceOf(sender.address)).to.equal(depositAmount);
          expect(await token.totalSupply()).to.equal(depositAmount);
          await expect(tx)
              .to.emit(l2Gateway, 'DepositFinalized')
              .withArgs(
                  mockL1LptEOA.address,
                  sender.address,
                  sender.address,
                  depositAmount,
              );
        });

        it('mints tokens for a 3rd party', async () => {
          const tx = await l2Gateway
              .connect(mockL1GatewayL2Alias)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  receiver.address,
                  depositAmount,
                  defaultData,
              );

          expect(await token.balanceOf(receiver.address)).to.be.eq(
              depositAmount,
          );
          expect(await token.totalSupply()).to.be.eq(depositAmount);
          await expect(tx)
              .to.emit(l2Gateway, 'DepositFinalized')
              .withArgs(
                  mockL1LptEOA.address,
                  sender.address,
                  receiver.address,
                  depositAmount,
              );
        });

        it('calls increaseL2SupplyFromL1() on L2LPTDataCache', async () => {
          await l2Gateway
              .connect(mockL1GatewayL2Alias)
              .finalizeInboundTransfer(
                  mockL1LptEOA.address,
                  sender.address,
                  receiver.address,
                  depositAmount,
                  defaultData,
              );

          expect(
              l2LPTDataCacheMock.increaseL2SupplyFromL1,
          ).to.be.calledOnceWith(depositAmount);
        });
      });
    });

    describe('when gateway is paused', () => {
      beforeEach(async function() {
        await l2Gateway.connect(governor).pause();
      });

      it('should allow minting', async () => {
        const tx = await l2Gateway
            .connect(mockL1GatewayL2Alias)
            .finalizeInboundTransfer(
                mockL1LptEOA.address,
                sender.address,
                sender.address,
                depositAmount,
                defaultData,
            );

        expect(await token.balanceOf(sender.address)).to.be.eq(depositAmount);
        expect(await token.totalSupply()).to.be.eq(depositAmount);
        await expect(tx)
            .to.emit(l2Gateway, 'DepositFinalized')
            .withArgs(
                mockL1LptEOA.address,
                sender.address,
                sender.address,
                depositAmount,
            );
      });
    });
  });

  describe('outboundTransfer', () => {
    const withdrawAmount = 100;
    const defaultData = '0x';
    const defaultDataWithNotEmptyCallHookData = '0x12';
    const expectedWithdrawalId = 0;
    const initialTotalL2Supply = 3000;

    beforeEach(async function() {
      await token.grantRole(
          ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
          owner.address,
      );
      await token.connect(owner).mint(sender.address, initialTotalL2Supply);
    });

    describe('when gateway is paused', async function() {
      beforeEach(async function() {
        await l2Gateway.connect(governor).pause();
      });

      it('should fail to tranfer', async () => {
        await expect(
            l2Gateway.outboundTransfer(
                mockL1LptEOA.address,
                sender.address,
                withdrawAmount,
                defaultData,
            ),
        ).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when gateway is not paused', async function() {
      it('should revert when called with a different token', async () => {
        const tx = l2Gateway.outboundTransfer(
            token.address,
            sender.address,
            withdrawAmount,
            defaultData,
        );
        await expect(tx).to.be.revertedWith('TOKEN_NOT_LPT');
      });

      it('should revert when funds are too low', async () => {
        const tx = l2Gateway
            .connect(sender)
            .outboundTransfer(
                mockL1LptEOA.address,
                sender.address,
                initialTotalL2Supply + 100,
                defaultData,
            );
        await expect(tx).to.be.revertedWith(
            'ERC20: burn amount exceeds balance',
        );
      });

      it('should revert when called with callHookData', async () => {
        const tx = l2Gateway.outboundTransfer(
            mockL1LptEOA.address,
            sender.address,
            withdrawAmount,
            defaultDataWithNotEmptyCallHookData,
        );
        await expect(tx).to.be.revertedWith('CALL_HOOK_DATA_NOT_ALLOWED');
      });

      it('should revert when bridge doesnt have minter role', async () => {
        // remove burn permissions
        await token.revokeRole(BURNER_ROLE, l2Gateway.address);

        const tx = l2Gateway.outboundTransfer(
            mockL1LptEOA.address,
            sender.address,
            withdrawAmount,
            defaultData,
        );

        await expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${l2Gateway.address.toLowerCase()} is missing role ${BURNER_ROLE}`
        );
      });

      it('sends message to L1 and burns tokens', async () => {
        const tx = await l2Gateway
            .connect(sender)
            .outboundTransfer(
                mockL1LptEOA.address,
                sender.address,
                withdrawAmount,
                defaultData,
            );

        expect(await token.balanceOf(sender.address)).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        expect(await token.totalSupply()).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        await expect(tx)
            .to.emit(l2Gateway, 'WithdrawalInitiated')
            .withArgs(
                mockL1LptEOA.address,
                sender.address,
                sender.address,
                expectedWithdrawalId,
                expectedWithdrawalId,
                withdrawAmount,
            );

        const calldata = new L1LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          mockL1LptEOA.address,
          sender.address,
          sender.address,
          withdrawAmount,
          ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'bytes'],
              [expectedWithdrawalId, defaultData],
          ),
        ]);
        expect(arbSysMock.sendTxToL1).to.be.calledOnceWith(
            mockL1GatewayEOA.address,
            calldata,
        );
      });

      it('sends message to L1 and burns tokens for 3rd party', async () => {
        const tx = await l2Gateway
            .connect(sender)
            .outboundTransfer(
                mockL1LptEOA.address,
                receiver.address,
                withdrawAmount,
                defaultData,
            );

        expect(await token.balanceOf(sender.address)).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        expect(await token.balanceOf(receiver.address)).to.be.eq(0);
        expect(await token.totalSupply()).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        await expect(tx)
            .to.emit(l2Gateway, 'WithdrawalInitiated')
            .withArgs(
                mockL1LptEOA.address,
                sender.address,
                receiver.address,
                expectedWithdrawalId,
                expectedWithdrawalId,
                withdrawAmount,
            );

        const calldata = new L1LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          mockL1LptEOA.address,
          sender.address,
          receiver.address,
          withdrawAmount,
          ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'bytes'],
              [expectedWithdrawalId, defaultData],
          ),
        ]);
        expect(arbSysMock.sendTxToL1).to.be.calledOnceWith(
            mockL1GatewayEOA.address,
            calldata,
        );
      });

      // eslint-disable-next-line
      it('sends message to L1 and burns tokens when called through router', async () => {
        const routerEncodedData = ethers.utils.defaultAbiCoder.encode(
            ['address', 'bytes'],
            [sender.address, defaultData],
        );

        const tx = await l2Gateway
            .connect(mockL2RouterEOA)
            .outboundTransfer(
                mockL1LptEOA.address,
                receiver.address,
                withdrawAmount,
                routerEncodedData,
            );

        expect(await token.balanceOf(sender.address)).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        expect(await token.balanceOf(receiver.address)).to.be.eq(0);
        expect(await token.totalSupply()).to.be.eq(
            initialTotalL2Supply - withdrawAmount,
        );
        await expect(tx)
            .to.emit(l2Gateway, 'WithdrawalInitiated')
            .withArgs(
                mockL1LptEOA.address,
                sender.address,
                receiver.address,
                expectedWithdrawalId,
                expectedWithdrawalId,
                withdrawAmount,
            );

        const calldata = new L1LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          mockL1LptEOA.address,
          sender.address,
          receiver.address,
          withdrawAmount,
          ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'bytes'],
              [expectedWithdrawalId, defaultData],
          ),
        ]);
        expect(arbSysMock.sendTxToL1).to.be.calledOnceWith(
            mockL1GatewayEOA.address,
            calldata,
        );
      });

      it('calls decreaseL2SupplyFromL1() on L2LPTDataCache', async () => {
        await l2Gateway
            .connect(sender)
            .outboundTransfer(
                mockL1LptEOA.address,
                sender.address,
                withdrawAmount,
                defaultData,
            );

        expect(l2LPTDataCacheMock.decreaseL2SupplyFromL1).to.be.calledOnceWith(
            withdrawAmount,
        );
      });
    });
  });
});
