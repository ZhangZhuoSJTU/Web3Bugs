# Specification

Caviar is an NFT AMM that uses the xy=k invariant for the swap curve.
Users can create shared liquidity pools (pairs) with constraints on which particular NFTs can be traded in those pairs. It makes sense to create pairs with groups of NFTs that are valued similarly by the market. For example, a pair to trade floor NFTs or a pair to trade rare NFTs.
In addition to this, each pair also contains a fractional ERC20 representation of the NFTs contained within it.
Users can wrap in and out of this fractional ERC20 token using valid NFTs in the pair.

# Factory (Caviar.sol)

The factory contract is responsible for creating new pairs.
Users can create new pairs for a given nft, base token and merkle root.
The merkle root is a hash of all the valid token ids which can be traded in a particular pair.
When a new pair is created its address is stored in a mapping.
An admin can remove a pair from this mapping by destroying it.

```solidity
create(address nft, address baseToken, bytes32 merkleRoot)
destroy(address nft, address baseToken, bytes32 merkleRoot)
```

# Pair (Pair.sol)

The logic in `Pair.sol` is split into three distinct logical parts. The core AMM, NFT wrapping, and the NFT AMM itself. The core AMM is a stripped down version of [UNI-V2](https://github.com/Uniswap/v2-core) that handles swapping between a base token (such as WETH or USDC) and a fractional NFT token. The NFT wrapping logic lets you wrap NFTs and receive ERC20 fractional tokens - or vice versa. The NFT AMM logic is a set of helper functions that wrap around the core AMM and the NFT wrapping logic.

In addition, there is a set of emergency exit logic functions which the admin can use to close the pair.

## Core AMM

The core AMM is comprised of four functions:

```solidity
add(uint256 baseTokenAmount, uint256 fractionalTokenAmount, uint256 minLpTokenAmount)
remove(uint256 lpTokenAmount, uint256 minBaseTokenOutputAmount, uint256 minFractionalTokenOutputAmount)
buy(uint256 outputAmount, uint256 maxInputAmount)
sell(uint256 inputAmount, uint256 minOutputAmount)
```

A liquidity provider can add liquidity by depositing some amount of base tokens and ERC20 fractional tokens.
In return they are minted some amount of an LP token to represent their share of liquidity in the pool.

They can also remove base tokens and fractional tokens by burning their LP token.

Traders can buy from the pool by sending an amount of base tokens. In return they will receive fractional ERC20 tokens.

Traders can sell from the pool by sending an amount of fractional tokens. In return they will receive base tokens.

Traders pay a 30bps (0.3%) fee each time they buy or sell. This fee accrues to the liquidity providers and acts as an incentive for people to deposit liquidity.

## NFT wrapping

NFT Wrapping consists of two functions:

```solidity
wrap(uint256[] tokenIds, bytes32[][] proofs)
unwrap(uint256[] tokenIds)
```

Users can wrap their NFTs and receive ERC20 tokens. 1e18 tokens are minted for each NFT that is wrapped.
When they wrap their NFTs they must also submit merkle proofs verifying that each token id exists in the pair's merkle root.

Users can unwrap their fractional ERC20 tokens by burning them. In return they will receive N amount of NFTs from the contract.

## NFT AMM

The NFT AMM acts as a container around both the core AMM logic and the NFT wrapping logic.
It is composed of four functions:

```solidity
nftAdd(uint256 baseTokenAmount, uint256[] tokenIds, uint256 minLpTokenAmount, bytes32[][] proofs)
nftRemove(uint256 lpTokenAmount, uint256 minBaseTokenOutputAmount, uint256[] tokenIds)
nftBuy(uint256[] tokenIds, uint256 maxInputAmount)
nftSell(uint256[] tokenIds, uint256 minOutputAmount, bytes32[][] proofs)
```

Liquidity providers can add their NFTs and base tokens as liquidity. They specify which token ids they would like to LP and provide a set of merkle proofs that show the particular tokenIds exist in the merkle root for the pair. In return they are minted some LP tokens.

They can also remove NFTs and base tokens from the pool by burning their LP tokens.

Traders buy NFTs from the pool by specifying which tokenIds they want to buy and sending the correct amount of base tokens to pay.

Traders can sell NFTs into the pool. When they sell NFTs they must also provide a set of merkle proofs that show each tokenId they are selling exists in the merkle root for the pair. In return they will receive some amount of base tokens.

---

## Emergency exit logic

Due to the discrete nature of NFTs and the fact that they can only be transferred in whole amounts, there is a possible edge case where liquidity can be trapped or "griefed".

Consider the scenario where Alice deposits 1 NFT and 200 USDC into a pool. Bob then buys 0.000001 fractional tokens from the pool and sends it to the zero address. Now there is 0.999999 fractional tokens, 200 USDC and 1 NFT in the pool. That NFT is effecively stuck because there only exists 0.9999999 fractional tokens in existence. So it's impossible for it to ever be unwrapped. If this situation ever arises, we need a way to withdraw the NFT and somehow make all of the fractional token holders whole.

The solution which we use works like the following:

- LP's make a claim to the admin that the pool is being griefed.

- Admin decides whether the claim is legitmate or not.

- Admin "closes" the pair, preventing future wraps (all other actions are still valid). The pair is also removed from the factory mapping (via `destroy()`). A 1 week grace period starts.

- After 1 week, the admin withdraws the NFTs in the contract and puts them up for auction. The proceeds from the auction are distributed pro rata to fractional token holders who can burn their tokens in exchange.

There are two functions in relation to this flow:

```solidity
close()
withdraw(uint256 tokenId)
```
