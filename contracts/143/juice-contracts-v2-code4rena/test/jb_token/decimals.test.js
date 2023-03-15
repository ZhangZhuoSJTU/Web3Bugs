import { expect } from 'chai';
import { deployJbToken } from '../helpers/utils';

describe('JBToken::decimals(...)', function () {
  it('Should have 18 decimals', async function () {
    const jbToken = await deployJbToken('asdf', 'asdf');
    const decimals = await jbToken.decimals();
    expect(decimals).to.equal(18);
  });
});
