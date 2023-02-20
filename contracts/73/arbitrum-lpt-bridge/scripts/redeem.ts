import {Wallet} from '@ethersproject/wallet';
import {ethers} from 'hardhat';
import {Bridge} from 'arb-ts';

async function main(): Promise<void> {
  const ethProvider = new ethers.providers.JsonRpcProvider(
      process.env.RINKEBY_URL,
  );

  const arbProvider = new ethers.providers.JsonRpcProvider(
      process.env.ARB_RINKEBY_URL,
  );

  const PK = process.env.PRIVATE_KEY || '';

  const l1TestWallet = new Wallet(PK, ethProvider);
  const l2TestWallet = new Wallet(PK, arbProvider);

  const bridge = await Bridge.init(l1TestWallet, l2TestWallet);

  const tx = await bridge.redeemRetryableTicket(
      '0xec4359f4989c0b0dbd9d45988cbe93a20e2ae5fd2ec7ca427673ebc5f6c7ceb5',
  );
  console.log(tx);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
