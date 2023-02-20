import { task } from 'hardhat/config';

import { BINANCE_ADDRESS, BINANCE7_ADDRESS, DAI_RICH_ADDRESS } from '../../Constant';
import { info, success } from '../../helpers';

export default task('fork:impersonate-accounts', 'Impersonate accounts').setAction(
  async (taskArguments, hre) => {
    info('Impersonate accounts...');

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: ['0x364d6D0333432C3Ac016Ca832fb8594A8cE43Ca6'],
    });

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [BINANCE_ADDRESS],
    });

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [BINANCE7_ADDRESS],
    });

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [DAI_RICH_ADDRESS],
    });

    success('Done!');
  },
);
