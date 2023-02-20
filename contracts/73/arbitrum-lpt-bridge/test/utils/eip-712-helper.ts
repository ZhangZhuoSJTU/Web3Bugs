import {toUtf8Bytes} from '@ethersproject/strings';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {ethers} from 'ethers';

type Message = {
  owner: string;
  spender: string;
  value: ethers.BigNumber;
  nonce: number;
  deadline: ethers.BigNumberish;
};

export const getSignature = async (
    signer: SignerWithAddress,
    name: string,
    chainId: number,
    verifyingContractAddress: string,
    message: Message,
) => {
  //   The meaning of `name` and `version` is specified in
  //   https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator[EIP 712]:

  const domain = {
    // eip-712 name [ token name ]
    name: name,
    // eip-712 version [ token name ]
    version: '1',
    chainId: chainId,
    // address of eip-712 contract [ token address ]
    verifyingContract: verifyingContractAddress,
  };

  // eip-2612 typehash
  const types = {
    Permit: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'},
    ],
  };

  const signature = await signer._signTypedData(domain, types, message);
  const {v, r, s} = ethers.utils.splitSignature(signature);

  return {v, r, s};
};

export const getDomainSeparator = (
    name: string,
    contract: string,
    chainId: number,
) => {
  return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            ethers.utils.keccak256(
                toUtf8Bytes(
                    // eslint-disable-next-line
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
                ),
            ),
            ethers.utils.keccak256(toUtf8Bytes(name)),
            ethers.utils.keccak256(toUtf8Bytes('1')),
            chainId,
            contract,
          ],
      ),
  );
};
