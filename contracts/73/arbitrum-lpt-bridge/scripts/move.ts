import {Wallet} from 'ethers';
import {ethers} from 'hardhat';
import {ARBITRUM_NETWORK} from '../deploy/constants';
import {L1LPTGateway__factory} from '../typechain';
import {
  getArbitrumCoreContracts,
  waitForTx,
  waitToRelayTxsToL2,
} from '../test/utils/messaging';
import hre from 'hardhat';

async function main(): Promise<void> {
  const {deployments} = hre;
  const l1GatewayAddress = (await deployments.get('L1LPTGateway')).address;
  const l1LPTAddress = (await deployments.get('L1_LPT')).address;

  const amount = ethers.utils.parseEther('10000');

  const ethProvider = new ethers.providers.JsonRpcProvider(
      process.env.RINKEBY_URL,
  );

  const arbProvider = new ethers.providers.JsonRpcProvider(
      process.env.ARB_RINKEBY_URL,
  );

  const PK = process.env.PRIVATE_KEY || '';

  const l1TestWallet = new Wallet(PK, ethProvider);
  const l2TestWallet = new Wallet(PK, arbProvider);

  const l1Gateway = new L1LPTGateway__factory(l1TestWallet).attach(
      l1GatewayAddress,
  );

  //   const token = new LivepeerToken__factory(l1TestWallet)
  //   .attach(l1LPTAddress);
  //   await token.approve(l1GatewayAddress, ethers.constants.MaxUint256)

  const gasPriceBid = await arbProvider.getGasPrice();

  const calldata = await l1Gateway.getOutboundCalldata(
      l1LPTAddress,
      l1TestWallet.address,
      l2TestWallet.address,
      amount,
      '0x',
  );
  const [submissionPrice] = await getArbitrumCoreContracts(
      arbProvider,
  ).arbRetryableTx.getSubmissionPrice(calldata.length);
  const maxSubmissionPrice = submissionPrice.mul(4);

  const [estimatedGas] = await getArbitrumCoreContracts(
      arbProvider,
  ).nodeInterface.estimateRetryableTicket(
      l1TestWallet.address,
      ethers.utils.parseEther('0.05'),
      l2TestWallet.address,
      0,
      maxSubmissionPrice,
      l2TestWallet.address,
      l2TestWallet.address,
      0,
      gasPriceBid,
      calldata,
  );
  const maxGas = estimatedGas.mul(4);

  const defaultData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [maxSubmissionPrice, '0x'],
  );
  const ethValue = await maxSubmissionPrice.add(gasPriceBid.mul(maxGas));

  const tx = l1Gateway.outboundTransfer(
      l1LPTAddress,
      l1TestWallet.address,
      amount,
      maxGas,
      gasPriceBid,
      defaultData,
      {
        value: ethValue,
      },
  );

  await waitToRelayTxsToL2(
      waitForTx(tx),
      ARBITRUM_NETWORK.rinkeby.inbox,
      ethProvider,
      arbProvider,
  );
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
