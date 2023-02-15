import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, Contract } from 'ethers';

const domainSchema = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const permitSchema = [
  { name: 'user', type: 'address' },
  { name: 'delegate', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

export const signDelegateMessage = async (signer: any, domain: any, message: any) => {
  let myAddr = signer.address;

  if (myAddr.toLowerCase() !== message.user.toLowerCase()) {
    throw `signDelegate: address of signer does not match user address in message`;
  }

  if (message.nonce === undefined) {
    let tokenAbi = ['function nonces(address user) view returns (uint)'];

    let tokenContract = new Contract(domain.verifyingContract, tokenAbi, signer);

    let nonce = await tokenContract.nonces(myAddr);

    message = { ...message, nonce: nonce.toString() };
  }

  let typedData = {
    types: {
      EIP712Domain: domainSchema,
      Delegate: permitSchema,
    },
    primaryType: 'Delegate',
    domain,
    message,
  };

  let sig;

  if (signer && signer.provider) {
    try {
      sig = await signer.provider.send('eth_signTypedData', [myAddr, typedData]);
    } catch (e: any) {
      if (/is not supported/.test(e.message)) {
        sig = await signer.provider.send('eth_signTypedData_v4', [myAddr, typedData]);
      }
    }
  }

  return { domain, message, sig };
}



type Delegate = {
  ticket: Contract,
  userWallet: SignerWithAddress;
  delegate: string;
};

export async function delegateSignature({
  ticket,
  userWallet,
  delegate
}: Delegate): Promise<any> {
  const nonce = (await ticket.nonces(userWallet.address)).toNumber()
  const chainId = (await ticket.provider.getNetwork()).chainId
  const deadline = (await ticket.provider.getBlock('latest')).timestamp + 100

  let delegateSig = await signDelegateMessage(
      userWallet,
      {
          name: 'PoolTogether ControlledToken',
          version: '1',
          chainId,
          verifyingContract: ticket.address,
      },
      {
          user: userWallet.address,
          delegate,
          nonce,
          deadline,
      },
  );

  const sig = ethers.utils.splitSignature(delegateSig.sig);

  return {
    user: userWallet.address,
    delegate,
    nonce,
    deadline,
    ...sig
  }
}
