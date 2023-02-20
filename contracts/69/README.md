# NFTX contest details
- $63,750 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-nftx-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 16, 2021 00:00 UTC
- Ends December 22, 2021 23:59 UTC

# Contracts

- NFTXEligibilityManager.sol (90 lines)
- NFTXInventoryStaking.sol (177 lines)
- NFTXLPStaking.sol (343 lines)
- NFTXMarketplaceZap.sol (613 lines)
  - calls external contract UniswapV2Router
- NFTXSimpleFeeDistributor.sol (171 lines)
- NFTXStakingZap.sol (477 lines)
  - calls external contract UniswapV2Router
- NFTXVaultFactoryUpgradeable.sol (219 lines)
- NFTXVaultUpgradeable.sol (561 lines)
- StakingTokenProvider.sol (90 lines)
- TimelockRewardDistributionTokenImpl.sol (246 lines)
- XTokenUpgradeable.sol (85 lines)

# Overview

NFTX is a protocol for making tokenized baskets of similarly priced NFTs which are called vaults. Every NFTX vault is also its own ERC20 token which is called a vault token, or vToken.

The primary vault operations are minting and redeeming. Minting takes an NFT from the user and gives a vToken in return. For example, in order for a user to mint 1 GLYPH token it is necessary that they give ownership of 1 autoglyph NFT to the vault. Redeeming is the opposite and requires that the user gives 1 vToken in order to receive 1 NFT (e.g. 1 GLYPH token for 1 autoglyph). Redeeming is random by default, but it is possible for specific NFT tokenIds to be inputed as a parameter to the redeem function. We refer to specific redeems as direct redeems. Both minting and redeeming can happen individually or in bulk, and both ERC721 and ERC1155 are supported.

The account which calls createVault on the factory contract gets designated as the vault manager during the vault's deployment and can then customize the vault's settings to their liking after it has been initialized. It is possible for the manager to toggle vault operations, set fees, and set custom eligibility preferences. When the manager is done customizing the vault they can then call a finalize function which renounces their control.

When vaults are deployed they are initially set to either allow all tokenIDs or to allow zero tokenIDs. Vaults which allow all tokenIDs are known as floor vaults. Vaults which allow no tokenIDs act as a blank canvas for vault managers to deploy what is called an eligibility module. There are different eligibility modules for different usecases. Each vault can have at most one eligibility module, but it is possible for custom eligibility modules to be developed and deployed manually.

SimpleFeeDistributor maintains a registry of addresses/contracts to distribute fee rewards to. When a vault is made, the factory contract calls the relevant functions to deploy any other required contracts with vault creation, ie. the xSLP (LPStaking) token and the xToken (InventoryStaking) contracts. Every time a fee is taken (mint/redeem/swap, etc), the fees are transferred to the SimpleFeeDistributor contract and distributeFees() is called in order to send the fees based on allocations set in the distributor. Our intended use for mainnet is 0.8 points towards LPStaking, and 0.2 points to InventoryStaking. This means LP stakers will receive 80% of the rewards and inventory stakers (single sided staking) will receive 20%.

When the LPStaking contracts receiveRewards() function is called, it passes the reward to TimelockRewardDistributionToken (the tokenized deposit of their LPs) which distributes fees in a similar manner to a dividend token. Note that if the user transfers their reward distribution tokens elsewhere, they will no longer be able to claim any pending rewards or receive any rewards. The rewards always go to whoever holds the dividend tokens.

For the InventoryStaking contract, when receiveRewards() is called it passes the reward tokens to the XTokenUpgradeable deployment for that given vault. This is very similar to SushiBar xSushi where stakers deposit to receive shares of the balance held in the XToken contract. While fees accumulate, stakers' shares will grow more in value and upon withdrawal they will receive the amount of XTokens adjusted for their share.

# Assumptions

You may assume that all NFT contracts are built in good faith and comply with either the ERC721 or ERC1155 spec.

# Important Invariants to Check For

Vaults should always maintain 1:1 ratio between vault token (ERC20) supply and vault (NFT) holdings. For example, if the supply of GLYPH is 42 then there should be exactly 42 autoglyphs owned by the vault contract. This rule also applies to ERC1155 collections, however since it's possible for each 1155 tokenID to have multiple copies, it is the sum of all tokenID balances which must equal the supply of the vToken (e.g. if there is an ERC1155 collection called CryptoPandas and there is an NFTX vault with the symbol PANDA and a supply of 7, then it would be possible for the vault to hold tokenIDs 123 and 132 with balances of 3 and 4, because 3 + 4 = 7).

Vault settings should only be configurable by the vault manager or the contract owner. When the vault manager is set to a non-zero address then it should be the only account which can modify settings. When the vault manager is set to the zero address, then control should be deferred to the contract owner (which will be the NFTX Dao).

# Previous Code Review

Much of the current NFTX v2 codebase already underwent a code review this past summer, and may be viewed at the following links:

- repo: https://github.com/code-423n4/2021-05-nftx
- findings: https://github.com/code-423n4/2021-05-nftx-findings/issues

Please do not submit any reports regarding gameable pseudorandomness. This is a design element of NFTX that we cannot change, such as changing to ChainLink VRF. We want to keep the simple randomness.

# Areas of Current Review

Since the last review, we have replaced the NFTXFeeDistributor contract with the NFTXSimpleFeeDistributor contract and we have also added the NFTXInventoryStaking contract. There has also been the addition of the NFTXStakingZap and NFTXMarketplaceZap contracts.

The most recent addition to the codebase is the NFTXInventoryStaking (ie. single-side staking), and this is also the only feature which is not yet in production. 

# Links

- [NFTX Twitter](https://twitter.com/NFTX_)
- [NFTX Discord](https://discord.com/invite/hytQVM5ZxR)
- [NFTX Website](https://nftx.io/)
