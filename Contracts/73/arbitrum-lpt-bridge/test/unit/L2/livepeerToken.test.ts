import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect} from 'chai';
import {ethers} from 'hardhat';
import {
  LivepeerToken,
  LivepeerToken__factory,
  MockSpender,
  MockSpender__factory,
} from '../../../typechain';
import {getSignature, getDomainSeparator} from '../../utils/eip-712-helper';

describe('LivepeerToken', function() {
  let token: LivepeerToken;
  let owner: SignerWithAddress;
  let mintController: SignerWithAddress;
  let burnController: SignerWithAddress;
  let notOwner: SignerWithAddress;

  const DEFAULT_ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const MINTER_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['MINTER_ROLE'],
  );

  const BURNER_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['BURNER_ROLE'],
  );

  beforeEach(async function() {
    [owner, mintController, burnController, notOwner] =
      await ethers.getSigners();

    const Token: LivepeerToken__factory = await ethers.getContractFactory(
        'LivepeerToken',
    );
    token = await Token.deploy();
    await token.deployed();
  });

  it('should match deployment params', async function() {
    const tokenName = await token.name();
    expect(tokenName).to.equal('Livepeer Token');

    const tokenSymbol = await token.symbol();
    expect(tokenSymbol).to.equal('LPT');

    const isAdmin = await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address);
    expect(isAdmin).to.be.true;
  });

  describe('mint', async function() {
    describe('caller does not have minter role', async function() {
      it('should fail to mint', async function() {
        const tx = token.mint(owner.address, ethers.utils.parseEther('10000'));

        await expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${MINTER_ROLE}`
        );
      });
    });

    describe('caller has minter role', async function() {
      beforeEach(async function() {
        await token.grantRole(MINTER_ROLE, mintController.address);
      });

      it('should mint tokens', async function() {
        const amount = ethers.utils.parseEther('10000');
        const balance = await token.balanceOf(owner.address);

        await token.connect(mintController).mint(owner.address, amount);

        const newBalance = await token.balanceOf(owner.address);
        expect(newBalance).to.equal(balance.add(amount));
      });

      it('should mint to another address', async function() {
        const amount = ethers.utils.parseEther('10000');
        const balance = await token.balanceOf(notOwner.address);

        await token.connect(mintController).mint(notOwner.address, amount);

        const newBalance = await token.balanceOf(notOwner.address);
        expect(newBalance).to.equal(balance.add(amount));
      });
    });
  });

  describe('burn', async function() {
    beforeEach(async function() {
      const amount = ethers.utils.parseEther('10000');
      await token.grantRole(MINTER_ROLE, mintController.address);
      await token.grantRole(BURNER_ROLE, burnController.address);
      await token.connect(mintController).mint(owner.address, amount);
      await token.connect(mintController).mint(notOwner.address, amount);
      await token.connect(mintController).mint(burnController.address, amount);
    });

    describe('caller does not have burner role', async function() {
      it('should fail to burn tokens for another address', async function() {
        const amount = ethers.utils.parseEther('5000');
        const tx = token.burn(notOwner.address, amount);

        await expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${BURNER_ROLE}`
        );
      });

      it('should fail to burn tokens for self', async function() {
        const amount = ethers.utils.parseEther('5000');
        const tx = token.connect(owner).burn(owner.address, amount);

        await expect(tx).to.be.revertedWith(
            // eslint-disable-next-line
          `AccessControl: account ${owner.address.toLocaleLowerCase()} is missing role ${BURNER_ROLE}`
        );
      });
    });

    describe('caller has burner role', async function() {
      it('should burn tokens for another address', async function() {
        const amount = ethers.utils.parseEther('5000');
        const balance = await token.balanceOf(owner.address);

        await token.connect(burnController).burn(owner.address, amount);

        const newBalance = await token.balanceOf(owner.address);
        expect(newBalance).to.equal(balance.sub(amount));
      });

      it('should burn tokens for self', async function() {
        const amount = ethers.utils.parseEther('5000');
        const balance = await token.balanceOf(burnController.address);

        await token
            .connect(burnController)
            .burn(burnController.address, amount);

        const newBalance = await token.balanceOf(burnController.address);
        expect(newBalance).to.equal(balance.sub(amount));
      });
    });
  });

  describe('EIP-2612 permit', async function() {
    // reference for understanding EIP-2612 flow
    // https://hackernoon.com/how-to-code-gas-less-tokens-on-ethereum-43u3ew4

    let chainId: number;

    beforeEach(async function() {
      const network = await ethers.provider.getNetwork();
      chainId = network.chainId;
    });

    it('initial nonce is 0', async function() {
      const initialNonce = await token.nonces(owner.address);
      expect(initialNonce).to.equal(0);
    });

    it('domain separator', async function() {
      const domainSeparator = await token.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.equal(
          getDomainSeparator('Livepeer Token', token.address, chainId),
      );
    });

    describe('permit', function() {
      let mockSpender: MockSpender;

      beforeEach(async function() {
        const amount = ethers.utils.parseEther('10000');
        await token.grantRole(MINTER_ROLE, mintController.address);
        await token.connect(mintController).mint(owner.address, amount);

        const MockSpender: MockSpender__factory =
          await ethers.getContractFactory('MockSpender');
        mockSpender = await MockSpender.deploy();
        await mockSpender.deployed();
      });

      describe('spender has no allowance', function() {
        it('should fail to move tokens to itself', async function() {
          const allowance = await token.allowance(
              owner.address,
              mockSpender.address,
          );
          expect(allowance).to.equal(0);

          const tx = mockSpender.transferTokens(
              owner.address,
              token.address,
              ethers.utils.parseEther('100'),
          );

          await expect(tx).to.be.revertedWith(
              'ERC20: transfer amount exceeds allowance',
          );
        });
      });

      describe('spender gets allowance', function() {
        describe('via approve', function() {
          it('should move tokens to itself', async function() {
            const approvedAmountInitial = await token.allowance(
                owner.address,
                mockSpender.address,
            );

            expect(approvedAmountInitial).to.equal(0);

            const amount = ethers.utils.parseEther('100');
            await token.approve(mockSpender.address, amount);

            await mockSpender.transferTokens(
                owner.address,
                token.address,
                amount,
            );

            const movedBalance = await token.balanceOf(mockSpender.address);
            expect(movedBalance).to.equal(amount);
          });
        });
        describe('via permit', function() {
          it('should fail if invalid signature', async function() {
            const approvedAmountInitial = await token.allowance(
                owner.address,
                mockSpender.address,
            );

            expect(approvedAmountInitial).to.equal(0);

            const amount = ethers.utils.parseEther('100');
            const message = {
              owner: owner.address,
              spender: notOwner.address,
              value: amount,
              nonce: 0,
              deadline: ethers.constants.MaxUint256,
            };

            const {v, r, s} = await getSignature(
                owner,
                await token.name(),
                chainId,
                token.address,
                message,
            );

            const tx = token.permit(
                owner.address,
                mockSpender.address,
                amount,
                ethers.constants.MaxUint256,
                v,
                r,
                s,
            );
            await expect(tx).to.be.revertedWith(
                'ERC20Permit: invalid signature',
            );
          });

          it('should fail if reused signature', async function() {
            const approvedAmountInitial = await token.allowance(
                owner.address,
                mockSpender.address,
            );

            expect(approvedAmountInitial).to.equal(0);

            const amount = ethers.utils.parseEther('100');
            const message = {
              owner: owner.address,
              spender: mockSpender.address,
              value: amount,
              nonce: 0,
              deadline: ethers.constants.MaxUint256,
            };

            const {v, r, s} = await getSignature(
                owner,
                await token.name(),
                chainId,
                token.address,
                message,
            );

            await token.permit(
                owner.address,
                mockSpender.address,
                amount,
                ethers.constants.MaxUint256,
                v,
                r,
                s,
            );

            const tx2 = token.permit(
                owner.address,
                mockSpender.address,
                amount,
                ethers.constants.MaxUint256,
                v,
                r,
                s,
            );

            await expect(tx2).to.be.revertedWith(
                'ERC20Permit: invalid signature',
            );
          });

          it('should fail if deadline passed', async function() {
            const approvedAmountInitial = await token.allowance(
                owner.address,
                mockSpender.address,
            );

            expect(approvedAmountInitial).to.equal(0);

            const amount = ethers.utils.parseEther('100');
            const message = {
              owner: owner.address,
              spender: mockSpender.address,
              value: amount,
              nonce: 0,
              deadline: Date.now() - 1000000000,
            };

            const {v, r, s} = await getSignature(
                owner,
                await token.name(),
                chainId,
                token.address,
                message,
            );

            const tx = token.permit(
                owner.address,
                mockSpender.address,
                amount,
                Date.now() - 1000000000,
                v,
                r,
                s,
            );

            await expect(tx).to.be.revertedWith(
                'ERC20Permit: invalid signature',
            );
          });

          it('should move tokens to itself', async function() {
            const approvedAmountInitial = await token.allowance(
                owner.address,
                mockSpender.address,
            );

            expect(approvedAmountInitial).to.equal(0);

            const amount = ethers.utils.parseEther('100');
            const message = {
              owner: owner.address,
              spender: mockSpender.address,
              value: amount,
              nonce: 0,
              deadline: ethers.constants.MaxUint256,
            };

            const {v, r, s} = await getSignature(
                owner,
                await token.name(),
                chainId,
                token.address,
                message,
            );

            await token.permit(
                owner.address,
                mockSpender.address,
                amount,
                ethers.constants.MaxUint256,
                v,
                r,
                s,
            );

            await mockSpender.transferTokens(
                owner.address,
                token.address,
                amount,
            );

            expect(await token.nonces(owner.address)).to.equal(1);
            const movedBalance = await token.balanceOf(mockSpender.address);
            expect(movedBalance).to.equal(amount);
          });
        });
      });
    });
  });
});
