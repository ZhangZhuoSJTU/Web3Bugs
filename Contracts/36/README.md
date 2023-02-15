# Kuiper contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-defiprotocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 16, 2021 00:00 UTC
- Ends September 22, 2021 23:59 UTC

# Contracts
- Factory.sol - 117 lines
  - Handles proposing new Baskets and creating Basket Contracts and Auction Contracts
  - Also controls various protocol parameters
- Basket.sol - 253 lines
  - Handles minting/burning basket tokens as well as holding the assets backing the Basket
  - Handles streaming fees to the basket publisher and the protocol
- Auction.sol - 152 lines
  - Handles rebalance auctions needed to rebalance baskets

Contracts are all in a standard Hardhat project

# Libraries used
- OpenZeppelin
-- SafeERC20, ERC20Upgradeable, IERC20, Ownable, Clones

# Info
- The protocol is an asset management protocol that bundles ERC20 tokens into baskets and mints an ERC20 token representing the basket. Each basket has a publisher who can propose basket weights and composition, a license streaming fee on the basket, as well as update the publisher of that basket, all of these actions are subject to a 24 hour timelock. Baskets are created through the Factory contract which also creates an Auction contract for each basket. When a new weighting proposal for a basket passes the timelock, a rebalancing auction is started where anyone can bond a portion of the basket token supply and settle the auction by rebalancing the basket. The amounts needed to rebalance the basket are determined by the new weights as well as how long it takes for the auction to become settled. If an auction has not been settled after being bonded within 24 hours, the bond can be burned and the auction will need to be started again. Bounties can also be added to the auction that are claimed by the auction settler to incentive rebalances.
- Streaming fees for a basket are split between the publisher as well as the protocol owner if the protocol fee is turned on. They are calculated and handled on each mint or burn of the basket. The protocol owner fee split must be less than 20% of the basket's license fee.
- The protocol owner can change auction parameters, such as the auction multiplier, the min amount needed to bond, how much the auction decrements, as well as settings related to the protocol fee (fee split and receiving address)
- Basket Tokens are standardized to 18 decimals
- Token weights are defined as the amount of that token in one basket token, multiplied by the current iBRation (Index to Basket Ratio)
- The protocol is designed for standard ERC20 tokens, it is not currently concerned with the potential effects of rebasing or non-standard ERC20 implementations.

# Areas of Concern to look at
- Logic related to rebalancing and settling auctions, that auctions are settled correctly with correct weights and in time.
- Logic related to streaming fees calculations, that they are calculated and handled correctly within minting and burning.
- Potential Token Approval issues
