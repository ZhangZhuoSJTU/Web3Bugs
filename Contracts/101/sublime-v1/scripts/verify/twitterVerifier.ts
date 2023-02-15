// const { ethers } = require('ethers');

// const providerT = new ethers.providers.JsonRpcProvider('https://kovan.infura.io/v3/76be62c162554c1e961f8406630fd52d')
// const signerT = new ethers.Wallet('0x9178dc78ec190be46f91b8f01da07e3384e38850189bfd5768b47da7be1951d9', providerT) // Private key of the contract admin

// async function twitterSignUserMessage() {

//     console.log(signerT)
//     let deadline = Math.floor(Date.now() / 1000) + 86400
//     const typedData = {
//         types:
//         {
//             set: [
//                 { name: 'twitterId', type: 'string' },
//                 { name: 'tweetId', type: 'string' },
//                 { name: 'userAddr', type: 'address' },
//                 { name: 'timestamp', type: 'uint256' },
//             ]
//         },
//         primaryType: 'set',
//         domain: { name: "sublime", version: "v1", chainId: 42, verifyingContract: '0xc9406F3A4C3B57b4067001591B0b36fDa9aec6E5' },
//         message: {
//             twitterId: "Kiora",
//             tweetId: "3",
//             userAddr: '0x4AE7f266b44ec119f66d0B2115b731bBa2b9b053', // Sender Address
//             timestamp: 1648184106,
//         }
//     }
//     console.log(deadline)
//     let signatures = await signerT._signTypedData(typedData.domain, typedData.types, typedData.message)
//     let splitSign = ethers.utils.splitSignature(signatures)

//     console.log(splitSign)
// }
// twitterSignUserMessage()
