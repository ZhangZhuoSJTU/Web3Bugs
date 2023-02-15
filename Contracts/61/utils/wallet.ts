import { ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import ethWallet from 'ethereumjs-wallet';

let extraKeys = [];
for (let index = 0; index < 200; index++) {
    let addressData = ethWallet.generate();
    extraKeys.push(addressData.getPrivateKeyString());
}
// Dont use 0x prefix in private key
const temp = [
    '6029243356ca0bbc9a9af7daa15ea9c3cb2e113157d3fe7b70047bdf2d69bdb3',
    '9178dc78ec190be46f91b8f01da07e3384e38850189bfd5768b47da7be1951d9',
    '6f59567a7059244b595bcce9646cd6c7bef949500f42aa1da6d898a9b4f31f10',
    '49cc55af035baf53c862cfe1520b438fe9a351d5f5aa7c3cc442953c2303ab1b',
    '3e8077859a437acf4066c399c0b5f371acf787875717f5c129dc4026bd1d3fc0',
    '10ebf2c84b3dab19ac4827fcc509b12342db133395b10face100c33a71a8419a',
    '4f511a888839c9707a0faa9853bc4f9e45988ea0910df536621dc39aecc01044',
    '67070b6f610d268d6a66126a6fd77566f5a46cf5d77818b7cec96092343a2d07',
    '4a69cdf060bc2ddaf3678decd61deacd59c8282c0476a194767ea8167cda07a7',
    '6a538e44cca04d67a6cdc58f655999be4822a39cc5a3c7f83e9314502734e16e',
    'e1999ff19390a6179fe204dd3bfbcadfa5cfb8a7e3aa430c1ae1ae62fc8c93b6',
    '1c1427ceed51224be2f97d7a4e025d9bbbdcd6c7a905e8f036875657495f57f1',
    '44ab8be4e17f61f922aa07211fa9aa55760b26378d5274641ffe0a235e0331db',
    'd28915cc7336c1e55da36aab1a2f0d878b03749f8e168c2dad62299ef8e1e2f0',
    'e6f967b8f577329a6b10ceef559ee6fcf16a5d709e02f73dd372f3cd1f289cce',
    'b5724e169d36137d0cf63aed31c8e8e4881ce9295abdb1fd4b4673bfa4b63e70',
    '8764d7e2ac3a8dc65fbc844b32db84b890c4a3c168a6c980c8e09110bf7633da',
    '92b7b786b70121828c25982fec2040204e53de254e1fa5f6eb26d9a755f5040b',
    '1d18f12171301a4f5a83fd5c7c8f9f8c1d4f15d872990c14c351cd09f60739c8',
    'c870b656f29b9d7fbc0d1e05414f2809c9c44b7c8a053aac2c0599a3076b5516',
    '47595c5cce2821b12e4eb7e69f7bfbc6ec4dd611738a918307e18d53df909694',
    'd164005c8dea1b5a97f107270b05a0f9ff70033030df304499423b6893951ff7',
    'b928f7797970982dd7f457e12f443ad33331f22ae2d57a963e0684a88fee4e49',
];

let privateKeys = temp.map((key) => `0x${key}`);
privateKeys = [...privateKeys, ...extraKeys];

let kovanPrivateKeys = [
    '6029243356ca0bbc9a9af7daa15ea9c3cb2e113157d3fe7b70047bdf2d69bdb3',
    '9178dc78ec190be46f91b8f01da07e3384e38850189bfd5768b47da7be1951d9',
    '6f59567a7059244b595bcce9646cd6c7bef949500f42aa1da6d898a9b4f31f10',
];

let rinkebyPrivateKeys = [
    '9a069a9a91cb42e2d4fb974b87c2137df807f4cf12808ece390e85a6787107f4', // 0xfb1304497e874ed934e34090b33ea07cb9723f35 0.033 needed atleast to deploy
    'abc8b3b0ab909a1f79a12144b2aa04c548be8e7dfa20d59fad9712754028b19f', // 0x20c4c3560ef3cacf59cb762aa63cef56fca570b5 0.003 needed atleast to deploy
    'b57992e36fcf5e1bf95840b39f83a5c57936bb391b50acad27e53b05bf751f71', // 0x666868a5a8a54d0782acdeb244ab277d5cb961af 0.0002 needed atleast to deploy
    '0aa752e618d9e21fd8dbe5a85ea61d007aa28b667f0b52a9e70e8f0814c62463', // 0x1aa2ed6ebe1c63d70b7c86ed7ee653fa08006ec1
    '0a9042c5153c7ba94798ade011e1dc332409c0b752081ba72bd03dd41332c910', // 0x6127148c761936461d5a36598b4f496704978f09
    'ff75a99d1608731d55a406e85d7abd84fdf6659498bb21f1f6d51f9ad2d518be', // 0x3ac9de706ce9238d8b551cdd92d1ef4a97f90c73
    '1ead78670c2664e59b12330ae3c803fdb6dc0026ab8b3ce6f909f23809a4732f', // 0xd72270bbe8b37d670afcbe3412a4d7c20d338ef3
    'e251b65e22a28d8cfea110f9f08debc2e6f7ee9b239558d9ff1546091ea28a85', // 0x7089696407c838d8eede662b4dce6e0b00c00b67
    'd9a7f88e19babe771b89a6b0c50a3cd88dc218fcb1af42bdc28b1e5cb99726b7', // 0x205acc1202003b3c92dc4b25e3fd97ddc8860873
    '5cc2eb071008653aa09bec9d7842f740af9c284d21358ec46d631a37f4ac9e66', // 0x6b7aec2a9087dcf6996832cf0ee59054f2345d28
];

export { privateKeys, kovanPrivateKeys, rinkebyPrivateKeys };

export function generatedWallets(provider: Provider) {
    return privateKeys.map((key: string) => {
        return new ethers.Wallet(key, provider);
    });
}
