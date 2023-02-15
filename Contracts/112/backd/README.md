# Backd Protocol

This is the official repository for the [Backd protocol](https://backd.fund/) contracts.

In addition to the code, check out the official [Backd documentation](https://docs.backd.fund/).

The [test suite](tests) repository is built with [Pytest](https://docs.pytest.org/en/6.2.x/), which is used by [Brownie](https://eth-brownie.readthedocs.io/en/stable/toctree.html).

The test suite relies on the following packages:

- [eth-brownie](https://github.com/eth-brownie/brownie): Testing framework for solidity and vyper code written in Python using Pytest
- [brownie-token-tester](https://github.com/iamdefinitelyahuman/brownie-token-tester): Custom mint logic for ERC20 tokens in `mainnet-fork` mode

### Getting Started

To get started using this repository, install the requirements (presumably in a virtual enviroment):

```
pip install -r requirements.txt
```

To run the full test suite, run:

```
brownie test
```

For a more detailed overview of how the Backd protocol can be tested, please read the [test suite documentation](tests/README.md).

To compile all contracts, run:

```
brownie compile
```

For a detailed overview of how to use Brownie, please check out the [official docs](https://eth-brownie.readthedocs.io/en/stable/toctree.html).

### Repository Structure

All Backd contracts are located within the [`contracts`](contracts) directory.

The tests are located within the [`tests`](tests) directory. The different liquidity pools that exist are specified in the tests directory [here](tests/configs).

### Environment Variables

The required environments variables that need to be set for running the test suite are listed [here](.env.example).

_Note_: The `ETHERSCAN_TOKEN` environment variable may need to be specified when running tests in `mainnet-fork` mode, as Etherscan is used to fetch the latest contract data and the API request limit may be reached.

## Deployed contracts

### Mainnet

#### Common contracts

Contract | Address
---------|---------
AddressProvider | [`0x139c15e21b0f6e43Fc397faCe5De5b7D5ae6874a`](https://etherscan.io/address/0x139c15e21b0f6e43Fc397faCe5De5b7D5ae6874a)
ChainlinkOracleProvider | [`0x275bB4476eBe0f1d6847bE66C8b00129fB71Ea5c`](https://etherscan.io/address/0x275bB4476eBe0f1d6847bE66C8b00129fB71Ea5c)
Controller | [`0xf88864B5D747961EB1CAf88d395D13aCa8274C9F`](https://etherscan.io/address/0xf88864B5D747961EB1CAf88d395D13aCa8274C9F)
PoolFactory | [`0x0B6A5F2EBc5e1BD38a4ec6a90844F45901E5B843`](https://etherscan.io/address/0x0B6A5F2EBc5e1BD38a4ec6a90844F45901E5B843)
RoleManager | [`0x83174c049116271f64a661b8371658792F62e363`](https://etherscan.io/address/0x83174c049116271f64a661b8371658792F62e363)
VaultReserve | [`0x07d142aBCCE99DEFA936e8E8c18595E5F30A109f`](https://etherscan.io/address/0x07d142aBCCE99DEFA936e8E8c18595E5F30A109f)
ChainlinkUsdWrapper (LDO) | [`0xC8988CEd1AE9Ba3019328108F35B76634d2c2D9E`](https://etherscan.io/address/0xC8988CEd1AE9Ba3019328108F35B76634d2c2D9E)

#### Template contracts

This contracts are used to deploy new pools but cannot not be used directly.

Contract | Address
---------|---------
Erc20Pool | [`0xedB53B9b0D1dF560A1C15A8FC05EDEBFB97A27C5`](https://etherscan.io/address/0xedB53B9b0D1dF560A1C15A8FC05EDEBFB97A27C5)
EthPool | [`0xCd283dFD87F5A5765AdCCBC9bE053e07f8d85505`](https://etherscan.io/address/0xCd283dFD87F5A5765AdCCBC9bE053e07f8d85505)
StakerVault | [`0xBc74FbE07E89b83399Dc1dD2Fb2C61EC7b94879e`](https://etherscan.io/address/0xBc74FbE07E89b83399Dc1dD2Fb2C61EC7b94879e)
Erc20Vault | [`0x00C3253d317ccA7Bf3F038288E61f14A9e3af8B2`](https://etherscan.io/address/0x00C3253d317ccA7Bf3F038288E61f14A9e3af8B2)
EthVault | [`0x76676E63C53f81938D5dD8FaFA8540Ca860aE926`](https://etherscan.io/address/0x76676E63C53f81938D5dD8FaFA8540Ca860aE926)
LpToken | [`0xa6c1d33837376F600e2f096D70356914255E29e6`](https://etherscan.io/address/0xa6c1d33837376F600e2f096D70356914255E29e6)

#### Pools

##### USDC Pool

Contract | Address
---------|---------
Pool     | [`0xdA83E512e2D675B8De524a6d21c86254dC7d47B6`](https://etherscan.io/address/0xdA83E512e2D675B8De524a6d21c86254dC7d47B6)
LP Token | [`0xfE5392049543e1FdCFAd9CD8a05A6D28EEf5E9b7`](https://etherscan.io/address/0xfE5392049543e1FdCFAd9CD8a05A6D28EEf5E9b7)
Vault | [`0xDabFF9c061ac7a1A06EC0b8d0eE2721D524F0ae9`](https://etherscan.io/address/0xDabFF9c061ac7a1A06EC0b8d0eE2721D524F0ae9)
Staker vault | [`0x156958F275C50CdB8dA95D8daEF051e9fBCec377`](https://etherscan.io/address/0x156958F275C50CdB8dA95D8daEF051e9fBCec377)
Strategy | [`0x5F0a7A6992BBFcB230B6E436fAF3B405713f9f0B`](https://etherscan.io/address/0x5f0a7a6992bbfcb230b6e436faf3b405713f9f0b)

#### DAI Pool

Contract | Address
---------|---------
Pool     | [`0x2C681E62De119DdCC8bb7E78D7eB92D6C88BcAFe`](https://etherscan.io/address/0x2C681E62De119DdCC8bb7E78D7eB92D6C88BcAFe)
LP Token | [`0x15CC2cc177CC56e795eBBD8a679984Db1EdDEb52`](https://etherscan.io/address/0x15cc2cc177cc56e795ebbd8a679984db1eddeb52)
Vault | [`0xab8DE9fF63632A6Ae8E99Fe0Cc13279862329C2C`](https://etherscan.io/address/0xab8de9ff63632a6ae8e99fe0cc13279862329c2c)
Staker vault | [`0x58c73C49F1bae7964DC309196900107BC3A529cB`](https://etherscan.io/address/0x58c73c49f1bae7964dc309196900107bc3a529cb)
Strategy | [`0x280BBd37463E4D278eEc651b0F153db06F9d4A86`](https://etherscan.io/address/0x280bbd37463e4d278eec651b0f153db06f9d4a86)

#### ETH Pool

Contract | Address
---------|---------
Pool     | [`0xdAe9AE3064340C8519b663d17e70C3D6912C79Fd`](https://etherscan.io/address/0xdAe9AE3064340C8519b663d17e70C3D6912C79Fd)
LP Token | [`0x05e27731b4b2c95E61Ff693B9F61FC36C9B7FD2f`](https://etherscan.io/address/0x05e27731b4b2c95e61ff693b9f61fc36c9b7fd2f)
Vault | [`0x19750C9d273C2b47756ED96B54b930aD3A7F1a0d`](https://etherscan.io/address/0x19750c9d273c2b47756ed96b54b930ad3a7f1a0d)
Staker vault | [`0x56Cb1DE99B3d93445B22b4315F4dF148EEF279F9`](https://etherscan.io/address/0x56cb1de99b3d93445b22b4315f4df148eef279f9)
Strategy | [`0xD6c08A65669Bf0b6f826521C08Dc8C215730223c`](https://etherscan.io/address/0xd6c08a65669bf0b6f826521c08dc8c215730223c)
