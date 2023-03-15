import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployJbToken } from '../helpers/utils';

describe('JBToken::approve(...)', function () {
  const PROJECT_ID = 10;
  const name = 'TestTokenDAO';
  const symbol = 'TEST';

  async function setup() {
    const [deployer, ...addrs] = await ethers.getSigners();
    const jbToken = await deployJbToken(name, symbol);
    return { deployer, addrs, jbToken };
  }

  it('Should approve and emit event if caller is owner', async function () {
    const { deployer, addrs, jbToken } = await setup();
    const addr = addrs[1];
    const numTokens = 3000;

    const mintTx = await jbToken
      .connect(deployer)
      ['approve(uint256,address,uint256)'](PROJECT_ID, addr.address, numTokens);

    await expect(mintTx)
      .to.emit(jbToken, 'Approval')
      .withArgs(deployer.address, addr.address, numTokens);

    // overloaded functions need to be called using the full function signature
    const allowance = await jbToken
      .connect(deployer)
      ['allowance(address,address)'](deployer.address, addr.address);
    expect(allowance).to.equal(numTokens);
  });
});
