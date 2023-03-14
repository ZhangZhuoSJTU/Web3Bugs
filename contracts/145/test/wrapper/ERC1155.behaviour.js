// Based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/test/token/ERC1155/ERC1155.behaviour.js
// Copyright (c) 2016-2020 zOS Global Limited
// Portions Copyright (c) 2021 Nick Johnson

const namehash = require('eth-ens-namehash').hash;
const { BN, constants, expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { ethers } = require('hardhat')

const { expect } = require('chai');

const { shouldSupportInterfaces } = require('./SupportsInterface.behaviour');

function shouldBehaveLikeERC1155(signers, [firstTokenId, secondTokenId, unknownTokenId], mint) {
  let token, minter, firstTokenHolder, secondTokenHolder, multiTokenHolder, recipient, proxy;
  let firstTokenHolderAddress, secondTokenHolderAddress, multiTokenHolderAddress, proxyAddress;
  const firstAmount = 1;
  const secondAmount = 1;
  let ERC1155ReceiverMock;

  const RECEIVER_SINGLE_MAGIC_VALUE = '0xf23a6e61';
  const RECEIVER_BATCH_MAGIC_VALUE = '0xbc197c81';

  before(async () => {
    ERC1155ReceiverMock = await ethers.getContractFactory('ERC1155ReceiverMock');
    [token, [minter, firstTokenHolder, secondTokenHolder, multiTokenHolder, recipient, proxy]] = signers();
    [firstTokenHolderAddress, secondTokenHolderAddress, multiTokenHolderAddress, recipientAddress, proxyAddress] = await Promise.all([firstTokenHolder, secondTokenHolder, multiTokenHolder, recipient, proxy].map((s) => s.getAddress()));
  });

  describe('like an ERC1155', function () {
    describe('balanceOf', function () {
      it('reverts when queried about the zero address', async function () {
        await expect(
          token.balanceOf(ZERO_ADDRESS, firstTokenId)).to.be.revertedWith(
          'ERC1155: balance query for the zero address',
        );
      });

      context('when accounts don\'t own tokens', function () {
        it('returns zero for given addresses', async function () {
          expect(await token.balanceOf(
            firstTokenHolderAddress,
            firstTokenId,
          )).to.be.bignumber.equal('0');

          expect(await token.balanceOf(
            secondTokenHolderAddress,
            secondTokenId,
          )).to.be.bignumber.equal('0');

          expect(await token.balanceOf(
            firstTokenHolderAddress,
            unknownTokenId,
          )).to.be.bignumber.equal('0');
        });
      });

      context('when accounts own some tokens', function () {
        beforeEach(async function () {
          await mint(firstTokenHolderAddress, secondTokenHolderAddress);
        });

        it('returns the amount of tokens owned by the given addresses', async function () {
          expect(await token.balanceOf(
            firstTokenHolderAddress,
            firstTokenId,
          )).to.be.bignumber.equal(firstAmount);

          expect(await token.balanceOf(
            secondTokenHolderAddress,
            secondTokenId,
          )).to.be.bignumber.equal(secondAmount);

          expect(await token.balanceOf(
            firstTokenHolderAddress,
            unknownTokenId,
          )).to.be.bignumber.equal('0');
        });
      });
    });

    describe('balanceOfBatch', function () {
      it('reverts when input arrays don\'t match up', async function () {
        await expect(
          token.balanceOfBatch(
            [firstTokenHolderAddress, secondTokenHolderAddress, firstTokenHolderAddress, secondTokenHolderAddress],
            [firstTokenId, secondTokenId, unknownTokenId],
          )).to.be.revertedWith(
          'ERC1155: accounts and ids length mismatch',
        );

        await expect(
          token.balanceOfBatch(
            [firstTokenHolderAddress, secondTokenHolderAddress],
            [firstTokenId, secondTokenId, unknownTokenId],
          )).to.be.revertedWith(
          'ERC1155: accounts and ids length mismatch',
        );
      });

      it('reverts when one of the addresses is the zero address', async function () {
        await expect(
          token.balanceOfBatch(
            [firstTokenHolderAddress, secondTokenHolderAddress, ZERO_ADDRESS],
            [firstTokenId, secondTokenId, unknownTokenId],
          )).to.be.revertedWith(
          'ERC1155: balance query for the zero address',
        );
      });

      context('when accounts don\'t own tokens', function () {
        it('returns zeros for each account', async function () {
          const result = await token.balanceOfBatch(
            [firstTokenHolderAddress, secondTokenHolderAddress, firstTokenHolderAddress],
            [firstTokenId, secondTokenId, unknownTokenId],
          );
          expect(result).to.be.an('array');
          expect(result[0]).to.be.a.bignumber.equal('0');
          expect(result[1]).to.be.a.bignumber.equal('0');
          expect(result[2]).to.be.a.bignumber.equal('0');
        });
      });

      context('when accounts own some tokens', function () {
        beforeEach(async function () {
            await mint(firstTokenHolderAddress, secondTokenHolderAddress);
        });

        it('returns amounts owned by each account in order passed', async function () {
          const result = await token.balanceOfBatch(
            [secondTokenHolderAddress, firstTokenHolderAddress, firstTokenHolderAddress],
            [secondTokenId, firstTokenId, unknownTokenId],
          );
          expect(result).to.be.an('array');
          expect(result[0]).to.be.a.bignumber.equal(secondAmount);
          expect(result[1]).to.be.a.bignumber.equal(firstAmount);
          expect(result[2]).to.be.a.bignumber.equal('0');
        });

        it('returns multiple times the balance of the same address when asked', async function () {
          const result = await token.balanceOfBatch(
            [firstTokenHolderAddress, secondTokenHolderAddress, firstTokenHolderAddress],
            [firstTokenId, secondTokenId, firstTokenId],
          );
          expect(result).to.be.an('array');
          expect(result[0]).to.be.a.bignumber.equal(result[2]);
          expect(result[0]).to.be.a.bignumber.equal(firstAmount);
          expect(result[1]).to.be.a.bignumber.equal(secondAmount);
          expect(result[2]).to.be.a.bignumber.equal(firstAmount);
        });
      });
    });

    describe('setApprovalForAll', function () {
      let tx;
      beforeEach(async function () {
        tx = await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, true);
      });

      it('sets approval status which can be queried via isApprovedForAll', async function () {
        expect(await token.isApprovedForAll(multiTokenHolderAddress, proxyAddress)).to.be.equal(true);
      });

      it('emits an ApprovalForAll log', function () {
        expect(tx).to.emit(token, 'ApprovalForAll').withArgs(multiTokenHolderAddress, proxyAddress, true );
      });

      it('can unset approval for an operator', async function () {
        await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, false);
        expect(await token.isApprovedForAll(multiTokenHolderAddress, proxyAddress)).to.be.equal(false);
      });

      it('reverts if attempting to approve self as an operator', async function () {
        await expect(
          token.connect(multiTokenHolder).setApprovalForAll(multiTokenHolderAddress, true)
        ).to.be.revertedWith(
          'ERC1155: setting approval status for self',
        );
      });
    });

    describe('safeTransferFrom', function () {
      beforeEach(async function () {
        await mint(multiTokenHolderAddress, multiTokenHolderAddress);
      });

      it('reverts when transferring more than balance', async function () {
        await expect(
          token.connect(multiTokenHolder).safeTransferFrom(
            multiTokenHolderAddress,
            recipientAddress,
            firstTokenId,
            firstAmount + 1,
            '0x',
          )).to.be.revertedWith(
          'ERC1155: insufficient balance for transfer',
        );
      });

      it('reverts when transferring to zero address', async function () {
        await expect(
          token.connect(multiTokenHolder).safeTransferFrom(
            multiTokenHolderAddress,
            ZERO_ADDRESS,
            firstTokenId,
            firstAmount,
            '0x',
          )).to.be.revertedWith(
          'ERC1155: transfer to the zero address',
        );
      });

      function transferWasSuccessful (vars) {
        let operator, from, id, value;

        before(() => {
          ({ operator, from, id, value } = vars());
        });

        it('debits transferred balance from sender', async function () {
          const newBalance = await token.balanceOf(from, id);
          expect(newBalance).to.be.a.bignumber.equal('0');
        });

        it('credits transferred balance to receiver', async function () {
          const newBalance = await token.balanceOf(this.toWhom, id);
          expect(newBalance).to.be.a.bignumber.equal(value);
        });

        it('emits a TransferSingle log', async function () {
          await expect(this.transfer).to.emit(token, 'TransferSingle').withArgs(
            operator,
            from,
            this.toWhom,
            id,
            value,
          );
        });
      }

      context('when called by the multiTokenHolder', async function () {
        beforeEach(async function () {
          this.toWhom = recipientAddress;
          (this.transfer =
            await token.connect(multiTokenHolder).safeTransferFrom(multiTokenHolderAddress, recipientAddress, firstTokenId, firstAmount, '0x'));
        });

        transferWasSuccessful.call(this, () => ({
          operator: multiTokenHolderAddress,
          from: multiTokenHolderAddress,
          id: firstTokenId,
          value: firstAmount,
        }));

        it('preserves existing balances which are not transferred by multiTokenHolder', async function () {
          const balance1 = await token.balanceOf(multiTokenHolderAddress, secondTokenId);
          expect(balance1).to.be.a.bignumber.equal(secondAmount);

          const balance2 = await token.balanceOf(recipientAddress, secondTokenId);
          expect(balance2).to.be.a.bignumber.equal('0');
        });
      });

      context('when called by an operator on behalf of the multiTokenHolder', function () {
        context('when operator is not approved by multiTokenHolder', function () {
          beforeEach(async function () {
            await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, false);
          });

          it('reverts', async function () {
            await expect(
              token.connect(proxy).safeTransferFrom(multiTokenHolderAddress, recipientAddress, firstTokenId, firstAmount, '0x')
            ).to.be.revertedWith(
              'ERC1155: caller is not owner nor approved',
            );
          });
        });

        context('when operator is approved by multiTokenHolder', function () {
          beforeEach(async function () {
            this.toWhom = recipientAddress;
            await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, true);
            (this.transfer =
              await token.connect(proxy).safeTransferFrom(multiTokenHolderAddress, recipientAddress, firstTokenId, firstAmount, '0x'));
          });

          transferWasSuccessful.call(this, () => ({
            operator: proxyAddress,
            from: multiTokenHolderAddress,
            id: firstTokenId,
            value: firstAmount,
          }));

          it('preserves operator\'s balances not involved in the transfer', async function () {
            const balance1 = await token.balanceOf(proxyAddress, firstTokenId);
            expect(balance1).to.be.a.bignumber.equal('0');

            const balance2 = await token.balanceOf(proxyAddress, secondTokenId);
            expect(balance2).to.be.a.bignumber.equal('0');
          });
        });
      });

      context('when sending to a valid receiver', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, false,
            RECEIVER_BATCH_MAGIC_VALUE, false,
          );
        });

        context('without data', function () {
          beforeEach(async function () {
            this.toWhom = this.receiver.address;
            this.transfer = await token.connect(multiTokenHolder).safeTransferFrom(
              multiTokenHolderAddress,
              this.receiver.address,
              firstTokenId,
              firstAmount,
              '0x'
            );
          });

          transferWasSuccessful.call(this, () => ({
            operator: multiTokenHolderAddress,
            from: multiTokenHolderAddress,
            id: firstTokenId,
            value: firstAmount,
          }));

          it('calls onERC1155Received', async function () {
            await expect(this.transfer).to.emit(this.receiver, 'Received').withArgs(
              multiTokenHolderAddress,
              multiTokenHolderAddress,
              firstTokenId,
              firstAmount,
              '0x'
            );
          });
        });

        context('with data', function () {
          const data = '0xf00dd00d';
          beforeEach(async function () {
            this.toWhom = this.receiver.address;
            this.transfer = await token.connect(multiTokenHolder).safeTransferFrom(
              multiTokenHolderAddress,
              this.receiver.address,
              firstTokenId,
              firstAmount,
              data
            );
          });

          transferWasSuccessful.call(this, () => ({
            operator: multiTokenHolderAddress,
            from: multiTokenHolderAddress,
            id: firstTokenId,
            value: firstAmount,
          }));

          it('calls onERC1155Received', async function () {
            await expect(this.transfer).to.emit(this.receiver, 'Received').withArgs(
              multiTokenHolderAddress,
              multiTokenHolderAddress,
              firstTokenId,
              firstAmount,
              data
            );
          });
        });
      });

      context('to a receiver contract returning unexpected value', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            '0x00c0ffee', false,
            RECEIVER_BATCH_MAGIC_VALUE, false,
          );
        });

        it('reverts', async function () {
          await expect(
            token.connect(multiTokenHolder).safeTransferFrom(multiTokenHolderAddress, this.receiver.address, firstTokenId, firstAmount, '0x')
          ).to.be.revertedWith(
            'ERC1155: ERC1155Receiver rejected tokens',
          );
        });
      });

      context('to a receiver contract that reverts', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, true,
            RECEIVER_BATCH_MAGIC_VALUE, false,
          );
        });

        it('reverts', async function () {
          await expect(
            token.connect(multiTokenHolder).safeTransferFrom(multiTokenHolderAddress, this.receiver.address, firstTokenId, firstAmount, '0x')
          ).to.be.revertedWith(
            'ERC1155ReceiverMock: reverting on receive',
          );
        });
      });

      context('to a contract that does not implement the required function', function () {
        it('reverts', async function () {
          const invalidReceiver = token;
          await expect(
            token.connect(multiTokenHolder).safeTransferFrom(multiTokenHolderAddress, invalidReceiver.address, firstTokenId, firstAmount, '0x')
          ).to.be.reverted;
        });
      });
    });

    describe('safeBatchTransferFrom', function () {
      beforeEach(async function () {
        await mint(multiTokenHolderAddress, multiTokenHolderAddress);
      });

      it('reverts when transferring amount more than any of balances', async function () {
        await expect(
          token.connect(multiTokenHolder).safeBatchTransferFrom(
            multiTokenHolderAddress, recipientAddress,
            [firstTokenId, secondTokenId],
            [firstAmount, secondAmount + 1],
            '0x',
          )).to.be.revertedWith(
          'ERC1155: insufficient balance for transfer',
        );
      });

      it('reverts when ids array length doesn\'t match amounts array length', async function () {
        await expect(
          token.connect(multiTokenHolder).safeBatchTransferFrom(
            multiTokenHolderAddress, recipientAddress,
            [firstTokenId],
            [firstAmount, secondAmount],
            '0x',
          )).to.be.revertedWith(
          'ERC1155: ids and amounts length mismatch',
        );

        await expect(
          token.connect(multiTokenHolder).safeBatchTransferFrom(
            multiTokenHolderAddress, recipientAddress,
            [firstTokenId, secondTokenId],
            [firstAmount],
            '0x',
          )).to.be.revertedWith(
          'ERC1155: ids and amounts length mismatch',
        );
      });

      it('reverts when transferring to zero address', async function () {
        await expect(
          token.connect(multiTokenHolder).safeBatchTransferFrom(
            multiTokenHolderAddress, ZERO_ADDRESS,
            [firstTokenId, secondTokenId],
            [firstAmount, secondAmount],
            '0x',
          )).to.be.revertedWith(
          'ERC1155: transfer to the zero address',
        );
      });

      function batchTransferWasSuccessful (vars) {
        before(() => {
          ({ operator, from, ids, values } = vars());
        });

        it('debits transferred balances from sender', async function () {
          const newBalances = await token.balanceOfBatch(new Array(ids.length).fill(from), ids);
          for (const newBalance of newBalances) {
            expect(newBalance).to.be.a.bignumber.equal('0');
          }
        });

        it('credits transferred balances to receiver', async function () {
          const newBalances = await token.balanceOfBatch(new Array(ids.length).fill(this.toWhom), ids);
          for (let i = 0; i < newBalances.length; i++) {
            expect(newBalances[i]).to.be.a.bignumber.equal(values[i]);
          }
        });

        it('emits a TransferBatch log', function () {
          expect(this.transfer).to.emit(token, 'TransferBatch').withArgs(
            operator,
            from,
            this.toWhom,
            ids,
            values,
          );
        });
      }

      context('when called by the multiTokenHolder', async function () {
        beforeEach(async function () {
          this.toWhom = recipientAddress;
          (this.transfer =
            await token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, recipientAddress,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x',
            ));
        });

        batchTransferWasSuccessful.call(this, () => ({
          operator: multiTokenHolderAddress,
          from: multiTokenHolderAddress,
          ids: [firstTokenId, secondTokenId],
          values: [firstAmount, secondAmount],
        }));
      });

      context('when called by an operator on behalf of the multiTokenHolder', function () {
        context('when operator is not approved by multiTokenHolder', function () {
          beforeEach(async function () {
            await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, false);
          });

          it('reverts', async function () {
            await expect(
              token.connect(proxy).safeBatchTransferFrom(
                multiTokenHolderAddress, recipientAddress,
                [firstTokenId, secondTokenId],
                [firstAmount, secondAmount],
                '0x',
              )).to.be.revertedWith(
              'ERC1155: transfer caller is not owner nor approved',
            );
          });
        });

        context('when operator is approved by multiTokenHolder', function () {
          beforeEach(async function () {
            this.toWhom = recipientAddress;
            await token.connect(multiTokenHolder).setApprovalForAll(proxyAddress, true);
            (this.transfer =
              await token.connect(proxy).safeBatchTransferFrom(
                multiTokenHolderAddress, recipientAddress,
                [firstTokenId, secondTokenId],
                [firstAmount, secondAmount],
                '0x',
              ));
          });

          batchTransferWasSuccessful.call(this, () => ({
            operator: proxyAddress,
            from: multiTokenHolderAddress,
            ids: [firstTokenId, secondTokenId],
            values: [firstAmount, secondAmount],
          }));

          it('preserves operator\'s balances not involved in the transfer', async function () {
            const balance1 = await token.balanceOf(proxyAddress, firstTokenId);
            expect(balance1).to.be.a.bignumber.equal('0');
            const balance2 = await token.balanceOf(proxyAddress, secondTokenId);
            expect(balance2).to.be.a.bignumber.equal('0');
          });
        });
      });

      context('when sending to a valid receiver', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, false,
            RECEIVER_BATCH_MAGIC_VALUE, false,
          );
        });

        context('without data', function () {
          beforeEach(async function () {
            this.toWhom = this.receiver.address;
            this.transfer = await token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, this.receiver.address,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x',
            );
          });

          batchTransferWasSuccessful.call(this, () => ({
            operator: multiTokenHolderAddress,
            from: multiTokenHolderAddress,
            ids: [firstTokenId, secondTokenId],
            values: [firstAmount, secondAmount],
          }));

          it('calls onERC1155BatchReceived', async function () {
            await expect(this.transfer).to.emit(this.receiver, 'BatchReceived').withArgs(
              multiTokenHolderAddress,
              multiTokenHolderAddress,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x',
            );
          });
        });

        context('with data', function () {
          const data = '0xf00dd00d';
          beforeEach(async function () {
            this.toWhom = this.receiver.address;
            this.transfer = await token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, this.receiver.address,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              data,
            );
          });

          batchTransferWasSuccessful.call(this, () => ({
            operator: multiTokenHolderAddress,
            from: multiTokenHolderAddress,
            ids: [firstTokenId, secondTokenId],
            values: [firstAmount, secondAmount],
          }));

          it('calls onERC1155Received', async function () {
            await expect(this.transfer).to.emit(this.receiver, 'BatchReceived').withArgs(
              multiTokenHolderAddress,
              multiTokenHolderAddress,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              data,
            );
          });
        });
      });

      context('to a receiver contract returning unexpected value', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, false,
            RECEIVER_SINGLE_MAGIC_VALUE, false,
          );
        });

        it('reverts', async function () {
          await expect(
            token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, this.receiver.address,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x'),
            ).to.be.revertedWith(
            'ERC1155: ERC1155Receiver rejected tokens',
          );
        });
      });

      context('to a receiver contract that reverts', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, false,
            RECEIVER_BATCH_MAGIC_VALUE, true,
          );
        });

        it('reverts', async function () {
          await expect(
            token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, this.receiver.address,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x')
            ).to.be.revertedWith(
            'ERC1155ReceiverMock: reverting on batch receive',
          );
        });
      });

      context('to a receiver contract that reverts only on single transfers', function () {
        beforeEach(async function () {
          this.receiver = await ERC1155ReceiverMock.deploy(
            RECEIVER_SINGLE_MAGIC_VALUE, true,
            RECEIVER_BATCH_MAGIC_VALUE, false,
          );

          this.toWhom = this.receiver.address;
          this.transfer = await token.connect(multiTokenHolder).safeBatchTransferFrom(
            multiTokenHolderAddress, this.receiver.address,
            [firstTokenId, secondTokenId],
            [firstAmount, secondAmount],
            '0x',
          );
        });

        batchTransferWasSuccessful.call(this, () => ({
          operator: multiTokenHolderAddress,
          from: multiTokenHolderAddress,
          ids: [firstTokenId, secondTokenId],
          values: [firstAmount, secondAmount],
        }));

        it('calls onERC1155BatchReceived', async function () {
          await expect(this.transfer).to.emit(this.receiver, 'BatchReceived').withArgs(
            multiTokenHolderAddress,
            multiTokenHolderAddress,
            [firstTokenId, secondTokenId],
            [firstAmount, secondAmount],
            '0x',
          );
        });
      });

      context('to a contract that does not implement the required function', function () {
        it('reverts', async function () {
          const invalidReceiver = token;
          await expect(
            token.connect(multiTokenHolder).safeBatchTransferFrom(
              multiTokenHolderAddress, invalidReceiver.address,
              [firstTokenId, secondTokenId],
              [firstAmount, secondAmount],
              '0x',
            )
          ).to.be.reverted;
        });
      });
    });

    shouldSupportInterfaces(() => token, ['ERC165', 'ERC1155']);
  });
}

module.exports = {
  shouldBehaveLikeERC1155
};
