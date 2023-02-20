import { Contract } from 'ethers';

const domainSchema = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const permitSchema = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

export const signPermit = async (signer: any, domain: any, message: any) => {
  let myAddr = signer.address;

  if (myAddr.toLowerCase() !== message.owner.toLowerCase()) {
    throw `signPermit: address of signer does not match owner address in message`;
  }

  if (message.nonce === undefined) {
    let tokenAbi = ['function nonces(address owner) view returns (uint)'];

    let tokenContract = new Contract(domain.verifyingContract, tokenAbi, signer);

    let nonce = await tokenContract.nonces(myAddr);

    message = { ...message, nonce: nonce.toString() };
  }

  let typedData = {
    types: {
      EIP712Domain: domainSchema,
      Permit: permitSchema,
    },
    primaryType: 'Permit',
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
