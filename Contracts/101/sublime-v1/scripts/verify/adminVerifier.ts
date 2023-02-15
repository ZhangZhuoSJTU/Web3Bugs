// const { ethers } = require('ethers');
// // import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// // import DeployHelper from 'utils/deploys';
// // import { AdminVerifier } from '@typechain/ethers-v5'

// const provider = new ethers.providers.JsonRpcProvider('https://kovan.infura.io/v3/76be62c162554c1e961f8406630fd52d')
// const signer = new ethers.Wallet('0x9178dc78ec190be46f91b8f01da07e3384e38850189bfd5768b47da7be1951d9', provider) // Private key of the contract admin
// // const proxyAdmin = new ethers.Wallet('6029243356ca0bbc9a9af7daa15ea9c3cb2e113157d3fe7b70047bdf2d69bdb3', provider)
// // const deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
// // let adminVerifierLogic: AdminVerifier = deployHelper.helper.deployAdminVerifier();

// async function signUserMessage() {

//     console.log(signer)
//     let deadline = Math.floor(Date.now() / 1000) + 86400
//     const typedData = {
//         types:
//         {
//             set: [
//                 { name: 'userData', type: 'string' },
//                 { name: 'userAddr', type: 'address' },
//                 { name: 'timestamp', type: 'uint256' },
//             ]
//         },
//         primaryType: 'set',
//         domain: { name: "name", version: "version", chainId: 42, verifyingContract: '0x0E07b9Bf2adEC47C5A608bfC5023d2947dAd6280' },
//         message: {
//             userData: "Kiora",
//             userAddr: '0x4AE7f266b44ec119f66d0B2115b731bBa2b9b053', // Sender Address
//             timestamp: 1648186101,
//         }
//     }
//     console.log(deadline)
//     let signatures = await signer._signTypedData(typedData.domain, typedData.types, typedData.message)
//     let splitSign = ethers.utils.splitSignature(signatures)

//     console.log(splitSign)
// }
// signUserMessage()
