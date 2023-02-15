'use strict';

const chai = require('chai');
const {
  utils: { splitSignature },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;

const CHAIN_ID = 1;
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const MintableCappedERC20 = require('../build/MintableCappedERC20.json');

const { it } = require('mocha');

describe('MintableCappedERC20', () => {
  const [ownerWallet, userWallet] = new MockProvider().getWallets();
  let token;

  beforeEach(async () => {
    const name = 'test';
    const symbol = 'test';
    const decimals = 16;
    const capacity = 0;

    token = await deployContract(ownerWallet, MintableCappedERC20, [
      name,
      symbol,
      decimals,
      capacity,
    ]);

    const amount = 1000000;
    await token.mint(userWallet.address, amount);
  });

  describe('burnFrom', () => {
    it('should burnFrom address after approval', async () => {
      const issuer = userWallet.address;
      const spender = ownerWallet.address;
      const amount = 1000;

      await expect(await token.connect(userWallet).approve(spender, amount))
        .to.emit(token, 'Approval')
        .withArgs(issuer, spender, amount);

      await expect(await token.burnFrom(issuer, amount))
        .to.emit(token, 'Transfer')
        .withArgs(issuer, ADDRESS_ZERO, amount);
    });
  });
  describe('ERC20 Permit', () => {
    it('should should set allowance by verifying permit', async () => {
      const issuer = userWallet.address;
      const spender = ownerWallet.address;
      const amount = 10000;
      const nonce = 0;
      const deadline = (1000 + Date.now() / 1000) | 0;

      const signature = splitSignature(
        await userWallet._signTypedData(
          {
            name: 'test',
            version: '1',
            chainId: CHAIN_ID,
            verifyingContract: token.address,
          },
          {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          {
            owner: issuer,
            spender,
            value: amount,
            nonce,
            deadline,
          },
        ),
      );

      await expect(
        await token.permit(
          issuer,
          spender,
          amount,
          deadline,
          signature.v,
          signature.r,
          signature.s,
        ),
      )
        .to.emit(token, 'Approval')
        .withArgs(issuer, spender, amount);
    });
  });
});
