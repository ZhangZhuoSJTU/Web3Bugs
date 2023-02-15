# NFTX contest details
- ~$60K (ETH) main award pot
- ~$6K (ETH) gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://c4-nftx.netlify.app/)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts May 6 00:00 UTC
- Ends May 11 23:59 UTC

This repo will be made public before the start of the contest.

## Overview
NFTX is a protocol for making tokenized baskets of similarly priced NFTs. Occasionally these baskets have been called funds but are officially referred to as vaults. Right now with version 1, all NFTX vaults have their state stored together but have seperate contracts for every ERC20 vault token (vtoken), however version 2 is designed so that every ERC20 vtoken also stores its own vault state and implements necessary vault functions. In this sense NFTXv2 combines vault logic and vault token logic into a single contract which is simply refferred to as a vault. These vaults get deployed using a vault factory contract.

The primary vault operations are minting and redeeming. Minting takes an NFT from the user and gives a vToken in return. For example, in order for a user to mint 1 GLYPH token it is necessary that they give ownership of 1 autoglyph NFT to the vault. Redeeming is the opposite and requires that the user gives 1 vToken in order to receive 1 NFT (e.g. 1 GLYPH token for 1 autoglyph). Redeeming is random by default, but it is possible for specific NFT tokenIds to be inputed as a parameter to the redeem function. We refer to specific redeems as direct redeems. Both minting and redeeming can happen individually or in bulk, and both ERC721 and ERC1155 are supported. 

The account which calls createVault on the factory contract gets designated as the vault manager during the vault's deployment and can then customize the vault's settings to their liking after it has been initialized. It is possible for the manager to toggle vault operations, set fees, and set custom eligibility preferences. When the manager is done customizing the vault they can then call a finalize function which renounces their control. 

When vaults are deployed they are initially set to either allow all tokenIDs or to allow zero tokenIDs. Vaults which allow all tokenIDs are known as floor vaults. Vaults which allow no tokenIDs act as a blank canvas for vault managers to deploy what is called an eligibility module. There are different eligibility modules for different usecases. Each vault can have at most one eligibility module, but it is possible for custom eligibility modules to be developped and deployed manually.

FeeDistributor maintains the treasury addr and a default allocation point for it of 0.2 points. When a vault is made, the factory contract adds a new FeeReceiver (being the LPStaking contract) with an allocation point of 0.5 into a vault-specific array in the FeeDistributor contract. Every time a fee is taken (mint/redeem/swap, etc), the fees are minted to the FeeDsitributor contract and distributeFees() is called in order to send the fees to the lp staking contract. For most vaults, since the treasury default alloc point is 0.2, and the LPStaking contract has a default of 0.5 alloc points, this means the treasury receives ~30% of all fees, while the LP staking contract receives the other ~70% unless other FeeReceivers" are added.

When the LPStaking contracts receiveRewards function is called, it passes the reward to the RewardDistributionToken (the tokenized deposit of their LPs) which distributes fees in a similar manner to a dividend token. Note that if the user transfers their reward distribution tokens elsewhere, they will still receive rewards to the account used to make the deposit.

## Assumptions
You may assume that all NFT contracts are built in good faith and comply with either the ERC721 or ERC1155 spec.

## Areas of Review
Vaults should *always* maintain 1:1 ratio between vault token (ERC20) supply and vault (NFT) holdings. For example, if the supply of GLYPH is 42 then there should be exactly 42 autoglyphs owned by the vault contract. This rule also applies to ERC1155 collections, however since it's possible for each 1155 tokenID to have multiple copies, it is the sum of all tokenID balances which must equal the supply of the vToken (e.g. if there is an ERC1155 collection called CryptoPandas and there is an NFTX vault with the symbol PANDA and a supply of 7, then it would be possible for the vault to hold tokenIDs 123 and 132 with balances of 3 and 4, because 3 + 4 = 7).

Vault settings should only be configurable by the vault manager or the contract owner. When the vault manager is set to a non-zero address then it should be the only account which can modify settings. When the vault manager is set to the zero address, then control should be deferred to the contract owner (which will be the NFTX Dao). 

Flash minting has also been included as a feature in the v2 codebase. Our hope is that it does not interfer with other vault operations and does not open vaults up to exploits, however we would appreciate contestants to review this as well.
