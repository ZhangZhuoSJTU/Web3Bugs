# Visor Finance contest details
- $60,000 USDC main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://c4-visorfinance.netlify.app/)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts 2021-05-13 00:00 UTC
- Ends 2021-05-19 23:59 UTC

Visor.sol is fork of Alchemist.wtc project's contracts/crucible/Crucible.sol which has been extended significantly.
  Of interest is the portion that has been added or altered.

**Altered:**
- transferERC20- Transfer ERC20 tokens out of vault by owner
  - changed 
    - IERC20(token).balanceOf(address(this)) >= getBalanceLocked(token).add(amount)
  - to 
    - IERC20(token).balanceOf(address(this)) >= (getBalanceLocked(token).add(amount)).add(timelockERC20Balances[token]),

**Added:**
- approveTransferERC20
  - Approve delegate account to transfer ERC721 tokens out of vault
- approveTransferERC721
  - Approve delegate account to transfer ERC20 tokens out of vault
- delegatedTransferERC20
  - Transfer ERC20 tokens out of vault with an approved account
- transferERC721
  - Transfer ERC721 out of vault
- onERC721Received
  - ERC721Reciever interface hook- add to nfts[] 
- timeLockERC721
  - Lock ERC721 in vault until expires, redeemable by recipient
- timeUnlockERC721
  - Withdraw ERC721 in vault post expires by recipient
- timeLockERC20
  - Lock ERC20 tokens for recipient in the vault for provided expiry timestamp 
- timeUnlockERC20
  - Withdraw ERC20 from vault post expires by recipient
- getNftById
  - Get ERC721 contract address, tokenId from nfts[] by index
- getNftIdByTokenIdAndAddr
  - Get index of ERC721 in nfts[] given ERC721 minter and tokenId
- getTimeLockCount
  - Get number of ERC20 timelocks for given token address
- getTimeLockERC721Count
  - Get number of timelocks for NFTs of a given ERC721 contract

Name:
Visor.sol (639 lines)

Libraries, interfaces relevant to scope:

- @openzeppelin/contracts/math/SafeMath.sol;
- @openzeppelin/contracts/token/ERC20/IERC20.sol;
- @openzeppelin/contracts/token/ERC721/IERC721.sol;
- @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol;
- @uniswap/lib/contracts/libraries/TransferHelper.sol;
- @openzeppelin/contracts/utils/Address.sol;
- /contracts/contracts/visor/OwnableERC721.sol
- /contracts/contracts/interfaces/IUniversalVault.sol

Libraries, interfaces not used in scope:

- @openzeppelin/contracts/proxy/Initializable.sol;
- @openzeppelin/contracts/utils/EnumerableSet.sol;
- /contracts/contracts/visor/ERC1271.sol
- /contracts/contracts/visor/EIP712.sol
- /contracts/contracts/interfaces/IVisorService.sol;
