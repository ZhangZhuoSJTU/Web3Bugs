import { BigNumber, ethers } from "ethers";

// Take a message, hash it and sign it with ETH_SIGN SignatureType
export async function ethSign(
  wallet: ethers.Wallet,
  message: string | Uint8Array
) {
  const hash = ethers.utils.keccak256(message);
  const hashArray = ethers.utils.arrayify(hash);
  const ethsigNoType = await wallet.signMessage(hashArray);
  return ethsigNoType + "02";
}

export async function ethSignTypedData(
  wallet: ethers.Wallet,
  domainHash: string,
  hashStruct: string | Uint8Array,
  nonce: BigNumber,
  sigType?: string
) {
  const EIP191_HEADER = "0x1901";
  const preHash = ethers.utils.solidityPack(
    ["bytes", "bytes32"],
    [EIP191_HEADER, domainHash]
  );
  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(["bytes", "bytes32"], [preHash, hashStruct])
  );

  const hashArray = ethers.utils.arrayify(hash);
  const ethsigNoType = await wallet.signMessage(hashArray);
  const paddedNonce = ethers.utils.solidityPack(["uint256"], [nonce]);
  const ethsigNoType_nonce = ethsigNoType + paddedNonce.slice(2); // encode packed the nonce
  return sigType ? ethsigNoType_nonce + sigType : ethsigNoType_nonce + "02";
}
