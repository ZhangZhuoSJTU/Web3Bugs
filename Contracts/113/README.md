# AbraNFT contest details
- $47,500 MIM main award pot
- $2,500 MIM gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-abranft-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 27, 2022 00:00 UTC
- Ends May 01, 2022 23:59 UTC

## Glossary

| Name                               | Description                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| Abracadabra                        | Abracadabra the Lending platform                                    |
| SPELL                              | Governance token Abracadabra                                        |
| MIM                                | Stablecoin minted by the DeFi protocol                              |
| Cauldron							 | Smart Contract handling the Lending Logic                           |
| Private Pool                       | Version of the Cauldron where the collateral is an NFT              |
| NFTs                               | Non-Fungible Tokens, ERC721s.                                       |
| CDP / Collateralized Debt Position | A loan backed by some form of collateral                            |
| LTV / Loan to Value                | Ratio of the debt position to the value of the collateral deposited |
| Share                              | A share is a Bentobox share.                                        |
| Collateral                         | The ERC721 (NFT) being used as collateral                           |
| Asset                              | The ERC20 Token that is borrowed                                    |



# Contest Scope

The scope of the contest is contracts/NFTPair.sol, a Private Pool that allows two parties to create a private loan with a NFT as collateral, and contracts/NFTPairWithOracle.sol, which is largely similar, but allows the option of early liquidation if the price drops below a floor set by an oracle.

## Getting started

The test cases in test/NFTPair.test.ts furnish examples of how to interact with the contract. Versions have also been deployed to Ropsten, using and entirely mocked environment that allows freely minting ERC-20 tokens, NFTs, and messing with the BentoBox balance, simulating vault gains/losses.

Tests can be run with

    yarn hardhat test

You may have to run

    yarn hardhat typechain

once before doing this.

## Protocol overview

Abracadabra.money is a lending platform that uses interest-bearing tokens (ibTKNs) or NFTs as collateral to borrow a USD pegged stablecoin (Magic Internet Money - MIM), that can be used as any other traditional stablecoin.
The protocol is governed by the SPELL token, that manages the parameters of the protocol, the use of the Treasury, the tokenomics.


## Smart Contracts

Abracadabra is built upon the Bentobox, and uses a custom version of the KASHI technology.
- Bentobox is a smart contract that stores funds, handles their transfers, supports flash loans, applications and strategies
- KASHI is a isolated lending market built on top of Bentobox technology. it features one smart contract per 'pair', a combination of the collateral and the borrowed asset.
- Cauldrons are a version of KASHI that uses a CDP to mint a stablecoin, MIM, instead of relying on LPs.
- NFT Pair are a version of Cauldrons where the collateral isn't an ERC20 token but an ERC721 token, the deal OTC, the parameters of the loan themselves pre-defined.

Bentobox, KASHI and Cauldrons as listed for context only, as the scope is the NFT Pair.

One NFTPair is deployed as a MasterContract, to be cloned into actual lending markets via the deploy() function of bentobox.

### NFTPair.sol (653 sloc)

This contract allows a lender and a borrower to do an OTC loan with an ERC721 as collateral and an ERC20 as borrowed asset. The parameters (valuation, duration and interests) are set by the users.

This contract uses the following libraries and interfaces:
- "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
- "@boringcrypto/boring-solidity/contracts/BoringOwnable.sol";
- "@boringcrypto/boring-solidity/contracts/Domain.sol";
- "@boringcrypto/boring-solidity/contracts/interfaces/IMasterContract.sol";
- "@boringcrypto/boring-solidity/contracts/libraries/BoringRebase.sol";
- "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
- "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";


The contract has multiple functions _(eg: requestLoan, removeCollateral, lend)_ that each have an action ID and that can be called either directly or via the cook() function, passing actions ID, value and data as arrays. This function allows for the execution of several actions within the same transaction, which is core to how abracadabra works.

## Testnet deployment

The NFTPair contract and all it's dependencies are deployed on the Ropsten Ethereum testnet:

- BentoBox: https://ropsten.etherscan.io/address/0x9a5620779fef1928ef87c1111491212efc2c3cb8

- master contract NFT Pair: https://ropsten.etherscan.io/address/0x3a341f5474aac54829a587ce6ab13c86af6b1e29#code
The MasterContract is already whitelisted in the mock BentoBox.

- Two mock ERC721 tokens, public mint() (but with sequential IDs)
    - "Apes":
    https://ropsten.etherscan.io/address/0xcCB893B3b5D7B003FEA0134215E4BCc6F8fb6aC7
    - "Bears"
    https://ropsten.etherscan.io/address/0x95d7c415baaff9446b457439f2ff269032a73ff6

- Mock ERC20 with public mint() ("free money")
    https://ropsten.etherscan.io/address/0xed79a29ce9f7e285be23e8fc32f74e5289713b86

- NFT Pair deployments using either contract, and the "free money":
    - "Apes"
      https://ropsten.etherscan.io/address/0x9AEEf9f52eCCef2dc970090c304635fb29161805
    - "Bears"
      https://ropsten.etherscan.io/address/0xb215b44c3439cA72170F379f12A78437eACE9a19

