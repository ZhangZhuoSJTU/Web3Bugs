import {Wallet} from 'ethers';
import {ethers} from 'hardhat';
import {ARBITRUM_NETWORK} from '../deploy/constants';
import {L1Migrator__factory} from '../typechain';
import {
  getArbitrumCoreContracts,
  waitForTx,
  waitToRelayTxsToL2,
} from '../test/utils/messaging';
import hre from 'hardhat';

async function main(): Promise<void> {
  const {deployments} = hre;

  // Creating RPC Providers
  const ethProvider = new ethers.providers.JsonRpcProvider(
      process.env.RINKEBY_URL,
  );
  const arbProvider = new ethers.providers.JsonRpcProvider(
      process.env.ARB_RINKEBY_URL,
  );
  const PK = process.env.PRIVATE_KEY || '';

  const l1TestWallet = new Wallet(PK, ethProvider);
  const l2TestWallet = new Wallet(PK, arbProvider);

  // Creating Contract Instance
  const l1MigratorAddress = (await deployments.get('L1Migrator')).address;
  const l1Migrator = new L1Migrator__factory(l1TestWallet).attach(
      l1MigratorAddress,
  );

  // Fetching Calldata to be submitted for calling L2 function
  const params = await l1Migrator.getMigrateDelegatorParams(
      l1TestWallet.address,
      l2TestWallet.address,
  );
  const calldata = params.data;

  // Calculating essential variables required for sending a cross-chain Tx
  // 1. maxGas
  // 2. gasPriceBid
  // 3. maxSubmissionPrice

  // current price/unit gas on arbitrum
  const gasPriceBid = await arbProvider.getGasPrice();

  // fetching submission price
  // https://developer.offchainlabs.com/docs/l1_l2_messages#parameters
  const [submissionPrice] = await getArbitrumCoreContracts(
      arbProvider,
  ).arbRetryableTx.getSubmissionPrice(calldata.length);

  // overpaying submission price to account for increase
  // https://developer.offchainlabs.com/docs/l1_l2_messages#important-note-about-base-submission-fee
  // the excess will be sent back to the refund address
  const maxSubmissionPrice = submissionPrice.mul(4);

  // calculating estimated gas for the tx
  const [estimatedGas] = await getArbitrumCoreContracts(
      arbProvider,
  ).nodeInterface.estimateRetryableTicket(
      l1TestWallet.address, // sender
      ethers.utils.parseEther('0.1'), // deposit value [1]
      l2TestWallet.address, // destination addr
      0, // l2 callvalue
      maxSubmissionPrice, // maxSubmissionPrice
      l2TestWallet.address, // excess submission cost refund addr
      l2TestWallet.address, // excess fee refund addr
      0, // Max gas deducted [2]
      gasPriceBid, // gasPrice Bid
      calldata, // calldata to submit
  );

  // [1] deposit value ideally should be maxSubmissionPrice + (estimatedGas * gasPrice)
  // [2] max gas deducted should be estimatedGas * 4
  //
  // however both of these params depend on estimated gas which is actually the return
  // value of the function. Hence using dummy values
  // 0 works as max gas but setting deposit value 0 gives an error

  // overpaying gas just in case
  // the excess will be sent back to the refund address
  const maxGas = estimatedGas.mul(4);

  // ethValue will be sent as callvalue
  // this entire amount will be used for successfully completing
  // the L2 side of the transaction
  // maxSubmissionPrice + totalGasPrice (estimatedGas * gasPrice)
  const ethValue = await maxSubmissionPrice.add(gasPriceBid.mul(maxGas));

  // actual transaction
  const tx = l1Migrator.migrateDelegator(
      l1TestWallet.address,
      l2TestWallet.address,
      await l1TestWallet.signMessage('test'),
      maxGas,
      gasPriceBid,
      maxSubmissionPrice,
      {
        value: ethValue,
      },
  );

  // logs
  // 1. L1 Tx hash
  // 2. L2 Tx hash
  // 3. L2 Ticket redemption hash

  // Ticket redemption hash is the one which has the L2 function call
  // L2 Tx Hash is just aliased L1 address redeeming ticket
  // users must be shown L2 Ticket Redemption hash
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
