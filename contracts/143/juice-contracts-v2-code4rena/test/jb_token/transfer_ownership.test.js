import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployJbToken } from '../helpers/utils';

describe('JBToken::transferOwnership(...)', function () {
  const name = 'TestTokenDAO';
  const symbol = 'TEST';
  const projectIdDoesntMatter = 123;

  async function setup() {
    const [deployer, ...addrs] = await ethers.getSigners();
    const jbToken = await deployJbToken(name, symbol);
    return { deployer, addrs, jbToken };
  }

  it('Should transfer ownership to another address if caller is owner', async function () {
    const { deployer, addrs, jbToken } = await setup();
    const newAddr = addrs[0];

    const transferOwnershipTx = await jbToken
      .connect(deployer)
      ['transferOwnership(uint256,address)'](projectIdDoesntMatter, newAddr.address);

    await expect(transferOwnershipTx)
      .to.emit(jbToken, 'OwnershipTransferred')
      .withArgs(deployer.address, newAddr.address);

    expect(await jbToken.owner()).to.equal(newAddr.address);
  });

  it(`Can't transfer ownership if caller isn't owner`, async function () {
    const { addrs, jbToken } = await setup();
    const newAddr = addrs[0];
    const nonOwner = addrs[1];
    await expect(
      jbToken
        .connect(nonOwner)
        ['transferOwnership(uint256,address)'](projectIdDoesntMatter, newAddr.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it(`Can't set new owner to zero address`, async function () {
    const { jbToken } = await setup();
    await expect(
      jbToken['transferOwnership(uint256,address)'](
        projectIdDoesntMatter,
        ethers.constants.AddressZero,
      ),
    ).to.be.revertedWith('Ownable: new owner is the zero address');
  });
});
