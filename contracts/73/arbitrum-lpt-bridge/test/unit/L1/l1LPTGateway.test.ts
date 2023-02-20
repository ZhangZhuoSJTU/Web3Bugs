import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';

import {ethers} from 'hardhat';
import {
  L1Escrow,
  L1Escrow__factory,
  L1LPTGateway,
  L1LPTGateway__factory,
  L2LPTGateway__factory,
  LivepeerToken,
  LivepeerToken__factory,
} from '../../../typechain';
import {FakeContract, MockContract, smock} from '@defi-wonderland/smock';

use(smock.matchers);

describe('L1 LPT Gateway', function() {
  let token: MockContract<LivepeerToken>;
  let escrow: L1Escrow;
  let l1Gateway: L1LPTGateway;
  let owner: SignerWithAddress;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let governor: SignerWithAddress;

  // mocks
  let inboxMock: FakeContract;
  let outboxMock: FakeContract;
  let bridgeMock: FakeContract;
  let minterMock: FakeContract;
  let mockInboxEOA: SignerWithAddress;
  let mockOutboxEOA: SignerWithAddress;
  let mockBridgeEOA: SignerWithAddress;
  let mockL1RouterEOA: SignerWithAddress;
  let mockL2GatewayEOA: SignerWithAddress;
  let mockL2LptEOA: SignerWithAddress;
  let mockMinterEOA: SignerWithAddress;

  const initialTotalL1Supply = 3000;
  const depositAmount = 100;

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
      mockOutboxEOA,
      mockInboxEOA,
      mockBridgeEOA,
      mockL1RouterEOA,
      mockL2GatewayEOA,
      mockL2LptEOA,
      mockMinterEOA,
    ] = await ethers.getSigners();

    const Token = await smock.mock<LivepeerToken__factory>('LivepeerToken');
    token = await Token.deploy();
    await token.deployed();

    const Escrow: L1Escrow__factory = await ethers.getContractFactory(
        'L1Escrow',
    );
    await token.grantRole(
        ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
        owner.address,
    );
    await token.mint(owner.address, initialTotalL1Supply);

    escrow = await Escrow.deploy();
    await escrow.deployed();

    const L1Gateway: L1LPTGateway__factory = await ethers.getContractFactory(
        'L1LPTGateway',
    );

    l1Gateway = await L1Gateway.deploy(
        mockL1RouterEOA.address,
        escrow.address,
        token.address,
        mockL2LptEOA.address,
        mockInboxEOA.address,
    );
    await l1Gateway.deployed();

    await escrow.approve(
        token.address,
        l1Gateway.address,
        ethers.constants.MaxUint256,
    );

    await token.transfer(sender.address, initialTotalL1Supply);
    await token.connect(sender).approve(l1Gateway.address, depositAmount);

    await l1Gateway.grantRole(GOVERNOR_ROLE, governor.address);
    await l1Gateway.connect(governor).setCounterpart(mockL2GatewayEOA.address);
    await l1Gateway.connect(governor).setMinter(mockMinterEOA.address);

    inboxMock = await smock.fake('IInbox', {
      address: mockInboxEOA.address,
    });

    outboxMock = await smock.fake('IOutbox', {
      address: mockOutboxEOA.address,
    });

    bridgeMock = await smock.fake('IBridge', {
      address: mockBridgeEOA.address,
    });

    minterMock = await smock.fake(
        'contracts/L1/gateway/L1LPTGateway.sol:IMinter',
        {
          address: mockMinterEOA.address,
        },
    );

    outboxMock.l2ToL1Sender.returns(mockL2GatewayEOA.address);
    inboxMock.bridge.returns(bridgeMock.address);
    bridgeMock.activeOutbox.returns(outboxMock.address);
  });

  describe('constructor', () => {
    describe('l2 token', () => {
      it('should return correct l2 token', async function() {
        const lpt = await l1Gateway.calculateL2TokenAddress(token.address);
        expect(lpt).to.equal(mockL2LptEOA.address);
      });

      // eslint-disable-next-line
      it('should return 0 address when called with incorrect l1 token', async function () {
        const lpt = await l1Gateway.calculateL2TokenAddress(
            ethers.utils.hexlify(ethers.utils.randomBytes(20)),
        );
        expect(lpt).to.equal('0x0000000000000000000000000000000000000000');
      });
    });

    describe('l1 counterpart', () => {
      it('should return correct l1 counterpart', async function() {
        const counterpart = await l1Gateway.counterpartGateway();
        expect(counterpart).to.equal(mockL2GatewayEOA.address);
      });
    });
  });

  describe('setCounterpart', () => {
    const newAddress = ethers.utils.getAddress(
        ethers.utils.solidityKeccak256(['string'], ['newAddress']).slice(0, 42),
    );

    describe('caller not governor', () => {
      it('should fail to change counterpart address', async function() {
        const tx = l1Gateway.connect(owner).setCounterpart(newAddress);
        expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${GOVERNOR_ROLE}`
        );
      });
    });

    describe('caller is governor', () => {
      it('should change counterpart address', async function() {
        await l1Gateway.connect(governor).setCounterpart(newAddress);
        const counterpart = await l1Gateway.counterpartGateway();
        expect(counterpart).to.equal(newAddress);
      });
    });
  });

  describe('setMinter', () => {
    const newAddress = ethers.utils.getAddress(
        ethers.utils.solidityKeccak256(['string'], ['newAddress']).slice(0, 42),
    );

    describe('caller not governor', () => {
      it('should fail to change minter address', async function() {
        const tx = l1Gateway.connect(owner).setMinter(newAddress);
        expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${GOVERNOR_ROLE}`
        );
      });
    });

    describe('caller is governor', () => {
      it('should change counterpart address', async function() {
        await l1Gateway.connect(governor).setMinter(newAddress);
        const minter = await l1Gateway.minter();
        expect(minter).to.equal(newAddress);
      });
    });
  });

  describe('outboundTransfer', async function() {
    const defaultGas = 42;
    const defaultEthValue = ethers.utils.parseEther('0.1');
    const maxSubmissionCost = 7;

    const emptyCallHookData = '0x';
    const defaultData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [maxSubmissionCost, emptyCallHookData],
    );

    const notEmptyCallHookData = '0x12';
    const defaultDataWithNotEmptyCallHookData =
      ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'bytes'],
          [maxSubmissionCost, notEmptyCallHookData],
      );

    describe('when gateway is paused', async function() {
      beforeEach(async function() {
        await l1Gateway.connect(governor).pause();
      });

      it('should fail to tranfer', async function() {
        const tx = l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                sender.address,
                depositAmount,
                defaultGas,
                0,
                defaultData,
                {
                  value: defaultEthValue,
                },
            );

        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('when gateway is not paused', async function() {
      it('should revert when tranferring non LPT token', async function() {
        const tx = l1Gateway
            .connect(sender)
            .outboundTransfer(
                ethers.utils.hexlify(ethers.utils.randomBytes(20)),
                sender.address,
                depositAmount,
                defaultGas,
                0,
                defaultData,
                {
                  value: defaultEthValue,
                },
            );

        await expect(tx).to.be.revertedWith('TOKEN_NOT_LPT');
      });

      it('should revert when approval is too low', async () => {
        const tx = l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                sender.address,
                depositAmount + 100,
                defaultGas,
                0,
                defaultData,
            );
        await expect(tx).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
        );
      });

      it('should revert when funds are too low', async () => {
        const tx = l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                sender.address,
                initialTotalL1Supply + 100,
                defaultGas,
                0,
                defaultData,
            );
        await expect(tx).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
        );
      });

      it('should revert when called with hook calldata', async () => {
        const tx = l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                sender.address,
                depositAmount,
                defaultGas,
                0,
                defaultDataWithNotEmptyCallHookData,
            );
        await expect(tx).to.be.revertedWith('CALL_HOOK_DATA_NOT_ALLOWED');
      });

      it('escrows funds and sends message to L2', async () => {
        const defaultInboxBalance = await mockInboxEOA.getBalance();

        const depositTx = await l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                sender.address,
                depositAmount,
                defaultGas,
                0,
                defaultData,
                {
                  value: defaultEthValue,
                },
            );

        const expectedDepositId = 0;
        const l2EncodedData = ethers.utils.defaultAbiCoder.encode(
            ['bytes', 'bytes'],
            ['0x', emptyCallHookData],
        );
        const expectedL2calldata = new L2LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          token.address,
          sender.address,
          sender.address,
          depositAmount,
          l2EncodedData,
        ]);

        expect(await token.balanceOf(sender.address)).to.equal(
            initialTotalL1Supply - depositAmount,
        );
        expect(await token.balanceOf(l1Gateway.address)).to.equal(0);
        expect(await token.balanceOf(escrow.address)).to.equal(depositAmount);

        expect(await mockInboxEOA.getBalance()).to.equal(
            defaultInboxBalance.add(defaultEthValue),
        );

        // 1. destAddr
        // 2. l2CallValue
        // 3. maxSubmissionCost
        // 4. excessFeeRefundAddress
        // 5. callValueRefundAddress
        // 6. maxGas
        // 7. gasPriceBid
        // 8. data
        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2GatewayEOA.address,
            0,
            maxSubmissionCost,
            sender.address,
            sender.address,
            defaultGas,
            0,
            expectedL2calldata,
        );

        await expect(depositTx)
            .to.emit(l1Gateway, 'DepositInitiated')
            .withArgs(
                token.address,
                sender.address,
                sender.address,
                expectedDepositId,
                depositAmount,
            );
        await expect(depositTx)
            .to.emit(l1Gateway, 'TxToL2')
            .withArgs(
                sender.address,
                mockL2GatewayEOA.address,
                expectedDepositId,
                expectedL2calldata,
            );
      });

      it('escrows funds and sends message to L2 for third party', async () => {
        const defaultInboxBalance = await mockInboxEOA.getBalance();

        const depositTx = await l1Gateway
            .connect(sender)
            .outboundTransfer(
                token.address,
                receiver.address,
                depositAmount,
                defaultGas,
                0,
                defaultData,
                {
                  value: defaultEthValue,
                },
            );

        const expectedDepositId = 0;
        const l2EncodedData = ethers.utils.defaultAbiCoder.encode(
            ['bytes', 'bytes'],
            ['0x', emptyCallHookData],
        );
        const expectedL2calldata = new L2LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          token.address,
          sender.address,
          receiver.address,
          depositAmount,
          l2EncodedData,
        ]);

        expect(await token.balanceOf(sender.address)).to.equal(
            initialTotalL1Supply - depositAmount,
        );
        expect(await token.balanceOf(receiver.address)).to.equal(0);
        expect(await token.balanceOf(l1Gateway.address)).to.equal(0);
        expect(await token.balanceOf(escrow.address)).to.equal(depositAmount);

        expect(await mockInboxEOA.getBalance()).to.equal(
            defaultInboxBalance.add(defaultEthValue),
        );

        // 1. destAddr
        // 2. l2CallValue
        // 3. maxSubmissionCost
        // 4. excessFeeRefundAddress
        // 5. callValueRefundAddress
        // 6. maxGas
        // 7. gasPriceBid
        // 8. data
        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2GatewayEOA.address,
            0,
            maxSubmissionCost,
            sender.address,
            sender.address,
            defaultGas,
            0,
            expectedL2calldata,
        );

        await expect(depositTx)
            .to.emit(l1Gateway, 'DepositInitiated')
            .withArgs(
                token.address,
                sender.address,
                receiver.address,
                expectedDepositId,
                depositAmount,
            );
        await expect(depositTx)
            .to.emit(l1Gateway, 'TxToL2')
            .withArgs(
                sender.address,
                mockL2GatewayEOA.address,
                expectedDepositId,
                expectedL2calldata,
            );
      });

      it('decodes data correctly when called via router', async () => {
        const routerEncodedData = ethers.utils.defaultAbiCoder.encode(
            ['address', 'bytes'],
            [sender.address, defaultData],
        );

        await token.approve(l1Gateway.address, depositAmount);
        const depositTx = await l1Gateway
            .connect(mockL1RouterEOA)
            .outboundTransfer(
                token.address,
                receiver.address,
                depositAmount,
                defaultGas,
                0,
                routerEncodedData,
            );
        const depositCallToMessenger = inboxMock.createRetryableTicket;

        const expectedDepositId = 0;
        const l2EncodedData = ethers.utils.defaultAbiCoder.encode(
            ['bytes', 'bytes'],
            ['0x', emptyCallHookData],
        );
        const expectedL2calldata = new L2LPTGateway__factory(
            owner,
        ).interface.encodeFunctionData('finalizeInboundTransfer', [
          token.address,
          sender.address,
          receiver.address,
          depositAmount,
          l2EncodedData,
        ]);

        expect(await token.balanceOf(sender.address)).to.equal(
            initialTotalL1Supply - depositAmount,
        );
        expect(await token.balanceOf(l1Gateway.address)).to.equal(0);
        expect(await token.balanceOf(escrow.address)).to.equal(depositAmount);

        // 1. destAddr
        // 2. l2CallValue
        // 3. maxSubmissionCost
        // 4. excessFeeRefundAddress
        // 5. callValueRefundAddress
        // 6. maxGas
        // 7. gasPriceBid
        // 8. data
        expect(depositCallToMessenger).to.be.calledOnceWith(
            mockL2GatewayEOA.address,
            0,
            maxSubmissionCost,
            sender.address,
            sender.address,
            defaultGas,
            0,
            expectedL2calldata,
        );

        await expect(depositTx)
            .to.emit(l1Gateway, 'DepositInitiated')
            .withArgs(
                token.address,
                sender.address,
                receiver.address,
                expectedDepositId,
                depositAmount,
            );
        await expect(depositTx)
            .to.emit(l1Gateway, 'TxToL2')
            .withArgs(
                sender.address,
                mockL2GatewayEOA.address,
                expectedDepositId,
                expectedL2calldata,
            );
      });
    });
  });

  describe('finalizeInboundTransfer', () => {
    const withdrawAmount = 100;
    const expectedTransferId = 1;
    const escrowBalance = 1000;
    const defaultWithdrawData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [expectedTransferId, '0x'],
    );

    beforeEach(async function() {
      await token.connect(owner).mint(escrow.address, escrowBalance);
    });

    it('reverts when called with a different token', async () => {
      const tx = l1Gateway
          .connect(mockBridgeEOA)
          .finalizeInboundTransfer(
              mockL2LptEOA.address,
              sender.address,
              sender.address,
              withdrawAmount,
              defaultWithdrawData,
          );
      await expect(tx).to.be.revertedWith('TOKEN_NOT_LPT');
    });

    it('reverts when called not by the outbox', async () => {
      const tx = l1Gateway.finalizeInboundTransfer(
          token.address,
          sender.address,
          sender.address,
          withdrawAmount,
          defaultWithdrawData,
      );
      await expect(tx).to.be.revertedWith('NOT_FROM_BRIDGE');
    });

    // eslint-disable-next-line
    it('reverts when called by the outbox but not relying message from l2 counterpart', async () => {
      outboxMock.l2ToL1Sender.returns(owner.address);

      const tx = l1Gateway
          .connect(mockBridgeEOA)
          .finalizeInboundTransfer(
              token.address,
              sender.address,
              sender.address,
              withdrawAmount,
              defaultWithdrawData,
          );

      await expect(tx).to.be.revertedWith('ONLY_COUNTERPART_GATEWAY');
    });

    describe('when gateway is not paused', () => {
      it('sends funds from the escrow', async () => {
        const initialSenderBalance = await token.balanceOf(sender.address);
        const initialEscrowBalance = await token.balanceOf(escrow.address);

        const finalizeWithdrawalTx = await l1Gateway
            .connect(mockBridgeEOA)
            .finalizeInboundTransfer(
                token.address,
                sender.address,
                sender.address,
                withdrawAmount,
                defaultWithdrawData,
            );

        expect(await token.balanceOf(sender.address)).to.be.equal(
            initialSenderBalance.add(withdrawAmount),
        );
        expect(await token.balanceOf(escrow.address)).to.be.equal(
            initialEscrowBalance.sub(withdrawAmount),
        );
        await expect(finalizeWithdrawalTx)
            .to.emit(l1Gateway, 'WithdrawalFinalized')
            .withArgs(
                token.address,
                sender.address,
                sender.address,
                expectedTransferId,
                withdrawAmount,
            );
      });

      it('sends funds from the escrow to the 3rd party', async () => {
        const initialSenderBalance = await token.balanceOf(sender.address);
        const initialReceiverBalance = await token.balanceOf(receiver.address);
        const initialEscrowBalance = await token.balanceOf(escrow.address);

        const finalizeWithdrawalTx = await l1Gateway
            .connect(mockBridgeEOA)
            .finalizeInboundTransfer(
                token.address,
                sender.address,
                receiver.address,
                withdrawAmount,
                defaultWithdrawData,
            );

        expect(await token.balanceOf(sender.address)).to.be.equal(
            initialSenderBalance,
        );
        expect(await token.balanceOf(receiver.address)).to.be.equal(
            initialReceiverBalance.add(withdrawAmount),
        );
        expect(await token.balanceOf(escrow.address)).to.be.equal(
            initialEscrowBalance.sub(withdrawAmount),
        );
        await expect(finalizeWithdrawalTx)
            .to.emit(l1Gateway, 'WithdrawalFinalized')
            .withArgs(
                token.address,
                sender.address,
                receiver.address,
                expectedTransferId,
                withdrawAmount,
            );
      });

      describe('escrow does not have sufficient funds', () => {
        it('mints excess tokens', async () => {
          const excessAmount = 200;

          const finalizeWithdrawalTx = await l1Gateway
              .connect(mockBridgeEOA)
              .finalizeInboundTransfer(
                  token.address,
                  sender.address,
                  sender.address,
                  escrowBalance + excessAmount,
                  defaultWithdrawData,
              );

          expect(token.transferFrom).to.be.calledWith(
              escrow.address,
              sender.address,
              escrowBalance,
          );

          expect(minterMock.bridgeMint).to.be.calledWith(
              sender.address,
              excessAmount,
          );

          await expect(finalizeWithdrawalTx)
              .to.emit(l1Gateway, 'WithdrawalFinalized')
              .withArgs(
                  token.address,
                  sender.address,
                  sender.address,
                  expectedTransferId,
                  escrowBalance + excessAmount,
              );
        });

        it('mints excess tokens to 3rd Party', async () => {
          const excessAmount = 200;

          const finalizeWithdrawalTx = await l1Gateway
              .connect(mockBridgeEOA)
              .finalizeInboundTransfer(
                  token.address,
                  sender.address,
                  receiver.address,
                  escrowBalance + excessAmount,
                  defaultWithdrawData,
              );

          expect(token.transferFrom).to.be.calledWith(
              escrow.address,
              receiver.address,
              escrowBalance,
          );

          expect(minterMock.bridgeMint).to.be.calledWith(
              receiver.address,
              excessAmount,
          );

          await expect(finalizeWithdrawalTx)
              .to.emit(l1Gateway, 'WithdrawalFinalized')
              .withArgs(
                  token.address,
                  sender.address,
                  receiver.address,
                  expectedTransferId,
                  escrowBalance + excessAmount,
              );
        });

        describe('escrow has 0 balance', () => {
          it('mints excess tokens', async () => {
            token.balanceOf.whenCalledWith(escrow.address).returns(0);
            const excessAmount = 200;

            const finalizeWithdrawalTx = await l1Gateway
                .connect(mockBridgeEOA)
                .finalizeInboundTransfer(
                    token.address,
                    sender.address,
                    sender.address,
                    escrowBalance + excessAmount,
                    defaultWithdrawData,
                );

            expect(token.transferFrom).to.not.be.called;

            expect(minterMock.bridgeMint).to.be.calledWith(
                sender.address,
                escrowBalance + excessAmount,
            );

            await expect(finalizeWithdrawalTx)
                .to.emit(l1Gateway, 'WithdrawalFinalized')
                .withArgs(
                    token.address,
                    sender.address,
                    sender.address,
                    expectedTransferId,
                    escrowBalance + excessAmount,
                );
          });
        });
      });
    });

    describe('when gateway is paused', () => {
      beforeEach(async function() {
        await l1Gateway.connect(governor).pause();
      });

      it('completes withdrawals even when closed', async () => {
        const initialSenderBalance = await token.balanceOf(sender.address);
        const initialEscrowBalance = await token.balanceOf(escrow.address);

        const finalizeWithdrawalTx = await l1Gateway
            .connect(mockBridgeEOA)
            .finalizeInboundTransfer(
                token.address,
                sender.address,
                sender.address,
                withdrawAmount,
                defaultWithdrawData,
            );

        expect(await token.balanceOf(sender.address)).to.be.equal(
            initialSenderBalance.add(withdrawAmount),
        );
        expect(await token.balanceOf(escrow.address)).to.be.equal(
            initialEscrowBalance.sub(withdrawAmount),
        );
        await expect(finalizeWithdrawalTx)
            .to.emit(l1Gateway, 'WithdrawalFinalized')
            .withArgs(
                token.address,
                sender.address,
                sender.address,
                expectedTransferId,
                withdrawAmount,
            );
      });
    });
  });
});
