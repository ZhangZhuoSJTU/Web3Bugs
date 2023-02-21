# Caviar contest details

- Total Prize Pool: \$36,500 USDC
  - HM awards: \$25,500 USDC
  - QA report awards: \$3,000 USDC
  - Gas report awards: \$1,500 USDC
  - Judge + presort awards: \$6,000
  - Scout awards: \$500 USDC
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-12-caviar-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 12, 2022 20:00 UTC
- Ends December 19, 2022 20:00 UTC

## C4udit / Publicly Known Issues

The C4audit output for the contest can be found [here](https://gist.github.com/Picodes/42f9144fd8cba738f3a7098411737760) within an hour of contest opening.

_Note for C4 wardens: Anything included in the C4udit output is considered a publicly known issue and is ineligible for awards._

# Caviar

[Caviar](https://goerli.caviar.sh) is a fully on-chain NFT AMM that allows you to trade every NFT in a collection (from floors to superrares). You can also trade fractional amounts of each NFT too.
It's designed with a heavy emphasis on composability, flexibility and usability. [View demo app here](https://goerli.caviar.sh).

## Index

- [Specification](https://github.com/code-423n4/2022-12-caviar/blob/main/docs/SPECIFICATION.md)

- [Testing](https://github.com/code-423n4/2022-12-caviar/blob/main/docs/TESTING.md)

- [Security considerations](https://github.com/code-423n4/2022-12-caviar/blob/main/docs/SECURITY.md)

## Quickstart command

```
rm -Rf 2022-12-caviar || true && git clone https://github.com/code-423n4/2022-12-caviar.git --recurse-submodules -j8 && cd 2022-12-caviar && yarn && foundryup && forge install && forge test --gas-report
```

## Getting started

```
yarn
foundryup
forge install
forge test --gas-report
```

## Contracts in scope

| File                                                                                  | SLOC | Description and coverage                                                     | Libraries                |
| ------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- | ------------------------ |
| Contracts (3)                                                                         |
| [Caviar.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Caviar.sol)   | 26   | Factory contract that creates pairs and maintains a registry (100%)          | `solmate`                |
| [Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)       | 212  | Pair contract that contains ERC20 AMM, NFT wrapping and NFT AMM logic (100%) | `solmate` `openzeppelin` |
| [LpToken.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/LpToken.sol) | 15   | ERC20 token which represents liquidity ownership in pair contracts (100%)    | `solmate`                |
| Libraries (1)                                                                         |
| [SafeERC20Namer.sol](https://github.com/code-423n4/2022-12-caviar/tree/main/src/lib)  | 65   | Helper contract that fetches the name and symbol of an ERC20/ERC721 (0%)     | `openzeppelin`           |
| Total                                                                                 | 318  |

## External imports

- **openzeppelin/utils/math/Math.sol**
  - [src/Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)
- **openzeppelin/utils/Strings.sol**
  - [src/lib/SafeERC20Namer.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/lib/SafeERC20Namer.sol)
- **solmate/auth/Owned.sol**
  - [src/Caviar.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Caviar.sol)
  - [src/LpToken.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/LpToken.sol)
- **solmate/tokens/ERC20.sol**
  - [src/LpToken.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/LpToken.sol)
  - [src/Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)
- **solmate/tokens/ERC721.sol**
  - [src/Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)
- **solmate/utils/MerkleProofLib.sol**
  - [src/Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)
- **solmate/utils/SafeTransferLib.sol**
  - [src/Pair.sol](https://github.com/code-423n4/2022-12-caviar/blob/main/src/Pair.sol)

## Deployments

**Goerli: ([demo app](https://goerli.caviar.sh))**

| Contract              | Address                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Caviar                | [0x4442fD4a38c6FBe364AdC6FF2CFA9332F0E7D378](https://goerli.etherscan.io/address/0x4442fD4a38c6FBe364AdC6FF2CFA9332F0E7D378) |
| FBAYC                 | [0xC1A308D95344716054d4C078831376FC78c4fd72](https://goerli.etherscan.io/address/0xC1A308D95344716054d4C078831376FC78c4fd72) |
| Pair (Rare FBAYC:ETH) | [0x7033A7A1980e019BA6A2016a14b3CD783e35300a](https://goerli.etherscan.io/address/0x7033A7A1980e019BA6A2016a14b3CD783e35300a) |
| LP Token (FBAYC:ETH)  | [0x96E6B35Cc73070FCDB42Abe5a39BfD7f16c37cFc](https://goerli.etherscan.io/address/0x96E6B35Cc73070FCDB42Abe5a39BfD7f16c37cFc) |

## Security considerations

### Rebase/fee-on-transfer tokens

Rebase and fee-on-transfer tokens are not supported by the AMM.
Using these tokens will break the swap curve and liquidity maths.

### Stuck tokens/nfts

There exists no recovery mechanism for tokens that are accidentally transferred to the AMM.
If tokens or NFTs are accidentally sent to the contract, then they cannot be withdrawn.

### Malicious base token or NFT contracts

It's assumed that all NFTs and base token contracts used to create new pairs are honest.
The user must use their own discretion when deciding whether or not to interact with a particular pair contract and check that the NFT and base token contracts are honest.

### Trusted admin

There exists functionality which allows an admin to withdraw NFTs from pairs.
It's assumed that the admin is trusted and legitimate. However, as an additional precaution, there is a one week grace period in which the admin must signal their intent to withdraw before _actually_ withdrawing.
This allows LPs and traders to withdraw their NFTs from the contract prior to the admin.

## Scoping Details

```
- If you have a public code repo, please share it here: https://github.com/outdoteth/Caviar
- How many contracts are in scope?:   4
- Total SLoC for these contracts?:  250
- How many external imports are there?: 7
- How many separate interfaces and struct definitions are there for the contracts within scope?:  3
- Does most of your code generally use composition or inheritance?:   Yes
- How many external calls?:   5
- What is the overall line coverage percentage provided by your tests?:  100
- Is there a need to understand a separate part of the codebase / get context in order to audit this part of the protocol?:  false
- Please describe required context:
- Does it use an oracle?:  false
- Does the token conform to the ERC20 standard?:  Yes
- Are there any novel or unique curve logic or mathematical models?: Nothing novel - using uni v2 style curves
- Does it use a timelock function?:  Yes
- Is it an NFT?: No
- Does it have an AMM?:   Yes
- Is it a fork of a popular project?:   false
- Does it use rollups?:   false
- Is it multi-chain?:  false
- Does it use a side-chain?: false
```
