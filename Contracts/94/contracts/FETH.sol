/*
  ･
   *　★
      ･ ｡
        　･　ﾟ☆ ｡
  　　　 *　★ ﾟ･｡ *  ｡
          　　* ☆ ｡･ﾟ*.｡
      　　　ﾟ *.｡☆｡★　･
​
                      `                     .-:::::-.`              `-::---...```
                     `-:`               .:+ssssoooo++//:.`       .-/+shhhhhhhhhhhhhyyyssooo:
                    .--::.            .+ossso+/////++/:://-`   .////+shhhhhhhhhhhhhhhhhhhhhy
                  `-----::.         `/+////+++///+++/:--:/+/-  -////+shhhhhhhhhhhhhhhhhhhhhy
                 `------:::-`      `//-.``.-/+ooosso+:-.-/oso- -////+shhhhhhhhhhhhhhhhhhhhhy
                .--------:::-`     :+:.`  .-/osyyyyyyso++syhyo.-////+shhhhhhhhhhhhhhhhhhhhhy
              `-----------:::-.    +o+:-.-:/oyhhhhhhdhhhhhdddy:-////+shhhhhhhhhhhhhhhhhhhhhy
             .------------::::--  `oys+/::/+shhhhhhhdddddddddy/-////+shhhhhhhhhhhhhhhhhhhhhy
            .--------------:::::-` +ys+////+yhhhhhhhddddddddhy:-////+yhhhhhhhhhhhhhhhhhhhhhy
          `----------------::::::-`.ss+/:::+oyhhhhhhhhhhhhhhho`-////+shhhhhhhhhhhhhhhhhhhhhy
         .------------------:::::::.-so//::/+osyyyhhhhhhhhhys` -////+shhhhhhhhhhhhhhhhhhhhhy
       `.-------------------::/:::::..+o+////+oosssyyyyyyys+`  .////+shhhhhhhhhhhhhhhhhhhhhy
       .--------------------::/:::.`   -+o++++++oooosssss/.     `-//+shhhhhhhhhhhhhhhhhhhhyo
     .-------   ``````.......--`        `-/+ooooosso+/-`          `./++++///:::--...``hhhhyo
                                              `````
   *　
      ･ ｡
　　　　･　　ﾟ☆ ｡
  　　　 *　★ ﾟ･｡ *  ｡
          　　* ☆ ｡･ﾟ*.｡
      　　　ﾟ *.｡☆｡★　･
    *　　ﾟ｡·*･｡ ﾟ*
  　　　☆ﾟ･｡°*. ﾟ
　 ･ ﾟ*｡･ﾟ★｡
　　･ *ﾟ｡　　 *
　･ﾟ*｡★･
 ☆∴｡　*
･ ｡
*/

// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./libraries/LockedBalance.sol";

error FETH_Cannot_Deposit_For_Lockup_With_Address_Zero();
error FETH_Escrow_Expired();
error FETH_Escrow_Not_Found();
error FETH_Expiration_Too_Far_In_Future();
/// @param amount The current allowed amount the spender is authorized to transact for this account.
error FETH_Insufficient_Allowance(uint256 amount);
/// @param amount The current available (unlocked) token count of this account.
error FETH_Insufficient_Available_Funds(uint256 amount);
/// @param amount The current number of tokens this account has for the given lockup expiry bucket.
error FETH_Insufficient_Escrow(uint256 amount);
error FETH_Invalid_Lockup_Duration();
error FETH_Market_Must_Be_A_Contract();
error FETH_Must_Deposit_Non_Zero_Amount();
error FETH_Must_Lockup_Non_Zero_Amount();
error FETH_No_Funds_To_Withdraw();
error FETH_Only_FND_Market_Allowed();
error FETH_Too_Much_ETH_Provided();
error FETH_Transfer_To_Burn_Not_Allowed();
error FETH_Transfer_To_FETH_Not_Allowed();

/**
 * @title An ERC-20 token which wraps ETH, potentially with a 1 day lockup period.
 * @notice FETH is an [ERC-20 token](https://eips.ethereum.org/EIPS/eip-20) modeled after
 * [WETH9](https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code).
 * It has the added ability to lockup tokens for 24-25 hours - during this time they may not be
 * transferred or withdrawn, except by our market contract which requested the lockup in the first place.
 * @dev Locked balances are rounded up to the next hour.
 * They are grouped by the expiration time of the lockup into what we refer to as a lockup "bucket".
 * At any time there may be up to 25 buckets but never more than that which prevents loops from exhausting gas limits.
 */
contract FETH {
  using AddressUpgradeable for address payable;
  using LockedBalance for LockedBalance.Lockups;
  using Math for uint256;

  /// @notice Tracks an account's info.
  struct AccountInfo {
    /// @notice The number of tokens which have been unlocked already.
    uint96 freedBalance;
    /// @notice The first applicable lockup bucket for this account.
    uint32 lockupStartIndex;
    /// @notice Stores up to 25 buckets of locked balance for a user, one per hour.
    LockedBalance.Lockups lockups;
    /// @notice Returns the amount which a spender is still allowed to withdraw from this account.
    mapping(address => uint256) allowance;
  }

  /// @notice Stores per-account details.
  mapping(address => AccountInfo) private accountToInfo;

  // Lockup configuration
  /// @notice The minimum lockup period in seconds.
  uint256 private immutable lockupDuration;
  /// @notice The interval to which lockup expiries are rounded, limiting the max number of outstanding lockup buckets.
  uint256 private immutable lockupInterval;

  /// @notice The Foundation market contract with permissions to manage lockups.
  address payable private immutable foundationMarket;

  // ERC-20 metadata fields
  /**
   * @notice The number of decimals the token uses.
   * @dev This method can be used to improve usability when displaying token amounts, but all interactions
   * with this contract use whole amounts not considering decimals.
   * @return 18
   */
  uint8 public constant decimals = 18;
  /**
   * @notice The name of the token.
   * @return Foundation Wrapped Ether
   */
  string public constant name = "Foundation Wrapped Ether";
  /**
   * @notice The symbol of the token.
   * @return FETH
   */
  string public constant symbol = "FETH";

  // ERC-20 events
  /**
   * @notice Emitted when the allowance for a spender account is updated.
   * @param from The account the spender is authorized to transact for.
   * @param spender The account with permissions to manage FETH tokens for the `from` account.
   * @param amount The max amount of tokens which can be spent by the `spender` account.
   */
  event Approval(address indexed from, address indexed spender, uint256 amount);
  /**
   * @notice Emitted when a transfer of FETH tokens is made from one account to another.
   * @param from The account which is sending FETH tokens.
   * @param to The account which is receiving FETH tokens.
   * @param amount The number of FETH tokens which were sent.
   */
  event Transfer(address indexed from, address indexed to, uint256 amount);

  // Custom events
  /**
   * @notice Emitted when FETH tokens are locked up by the Foundation market for 24-25 hours
   * and may include newly deposited ETH which is added to the account's total FETH balance.
   * @param account The account which has access to the FETH after the `expiration`.
   * @param expiration The time at which the `from` account will have access to the locked FETH.
   * @param amount The number of FETH tokens which where locked up.
   * @param valueDeposited The amount of ETH added to their account's total FETH balance,
   * this may be lower than `amount` if available FETH was leveraged.
   */
  event BalanceLocked(address indexed account, uint256 indexed expiration, uint256 amount, uint256 valueDeposited);
  /**
   * @notice Emitted when FETH tokens are unlocked by the Foundation market.
   * @dev This event will not be emitted when lockups expire,
   * it's only for tokens which are unlocked before their expiry.
   * @param account The account which had locked FETH freed before expiration.
   * @param expiration The time this balance was originally scheduled to be unlocked.
   * @param amount The number of FETH tokens which were unlocked.
   */
  event BalanceUnlocked(address indexed account, uint256 indexed expiration, uint256 amount);
  /**
   * @notice Emitted when ETH is withdrawn from a user's account.
   * @dev This may be triggered by the user, an approved operator, or the Foundation market.
   * @param from The account from which FETH was deducted in order to send the ETH.
   * @param to The address the ETH was sent to.
   * @param amount The number of tokens which were deducted from the user's FETH balance and transferred as ETH.
   */
  event ETHWithdrawn(address indexed from, address indexed to, uint256 amount);

  /// @dev Allows the Foundation market permission to manage lockups for a user.
  modifier onlyFoundationMarket() {
    if (msg.sender != foundationMarket) {
      revert FETH_Only_FND_Market_Allowed();
    }
    _;
  }

  /**
   * @notice Initializes variables which may differ on testnet.
   * @param _foundationMarket The address of the Foundation NFT marketplace.
   * @param _lockupDuration The minimum length of time to lockup tokens for when `BalanceLocked`, in seconds.
   */
  constructor(address payable _foundationMarket, uint256 _lockupDuration) {
    if (!_foundationMarket.isContract()) {
      revert FETH_Market_Must_Be_A_Contract();
    }
    foundationMarket = _foundationMarket;
    lockupDuration = _lockupDuration;
    lockupInterval = _lockupDuration / 24;
    if (lockupInterval * 24 != _lockupDuration || _lockupDuration == 0) {
      revert FETH_Invalid_Lockup_Duration();
    }
  }

  /**
   * @notice Transferring ETH (via `msg.value`) to the contract performs a `deposit` into the user's account.
   */
  receive() external payable {
    depositFor(msg.sender);
  }

  /**
   * @notice Approves a `spender` as an operator with permissions to transfer from your account.
   * @param spender The address of the operator account that has approval to spend funds
   * from the `msg.sender`'s account.
   * @param amount The max number of FETH tokens from `msg.sender`'s account that this spender is
   * allowed to transact with.
   * @return success Always true.
   */
  function approve(address spender, uint256 amount) external returns (bool success) {
    accountToInfo[msg.sender].allowance[spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  /**
   * @notice Deposit ETH (via `msg.value`) and receive the equivalent amount in FETH tokens.
   * These tokens are not subject to any lockup period.
   */
  function deposit() external payable {
    depositFor(msg.sender);
  }

  /**
   * @notice Deposit ETH (via `msg.value`) and credit the `account` provided with the equivalent amount in FETH tokens.
   * These tokens are not subject to any lockup period.
   * @dev This may be used by the Foundation market to credit a user's account with FETH tokens.
   * @param account The account to credit with FETH tokens.
   */
  function depositFor(address account) public payable {
    if (msg.value == 0) {
      revert FETH_Must_Deposit_Non_Zero_Amount();
    }
    AccountInfo storage accountInfo = accountToInfo[account];
    // ETH value cannot realistically overflow 96 bits.
    unchecked {
      accountInfo.freedBalance += uint96(msg.value);
    }
    emit Transfer(address(0), account, msg.value);
  }

  /**
   * @notice Used by the market contract only:
   * Remove an account's lockup and then create a new lockup, potentially for a different account.
   * @dev Used by the market when an offer for an NFT is increased.
   * This may be for a single account (increasing their offer)
   * or two different accounts (outbidding someone elses offer).
   * @param unlockFrom The account whose lockup is to be removed.
   * @param unlockExpiration The original lockup expiration for the tokens to be unlocked.
   * This will revert if the lockup has already expired.
   * @param unlockAmount The number of tokens to be unlocked from `unlockFrom`'s account.
   * This will revert if the tokens were previously unlocked.
   * @param lockupFor The account to which the funds are to be deposited for (via the `msg.value`) and tokens locked up.
   * @param lockupAmount The number of tokens to be locked up for the `lockupFor`'s account.
   * `msg.value` must be <= `lockupAmount` and any delta will be taken from the account's available FETH balance.
   * @return expiration The expiration timestamp for the FETH tokens that were locked.
   */
  function marketChangeLockup(
    address unlockFrom,
    uint256 unlockExpiration,
    uint256 unlockAmount,
    address lockupFor,
    uint256 lockupAmount
  ) external payable onlyFoundationMarket returns (uint256 expiration) {
    _marketUnlockFor(unlockFrom, unlockExpiration, unlockAmount);
    return _marketLockupFor(lockupFor, lockupAmount);
  }

  /**
   * @notice Used by the market contract only:
   * Lockup an account's FETH tokens for 24-25 hours.
   * @dev Used by the market when a new offer for an NFT is made.
   * @param account The account to which the funds are to be deposited for (via the `msg.value`) and tokens locked up.
   * @param amount The number of tokens to be locked up for the `lockupFor`'s account.
   * `msg.value` must be <= `amount` and any delta will be taken from the account's available FETH balance.
   * @return expiration The expiration timestamp for the FETH tokens that were locked.
   */
  function marketLockupFor(address account, uint256 amount)
    external
    payable
    onlyFoundationMarket
    returns (uint256 expiration)
  {
    return _marketLockupFor(account, amount);
  }

  /**
   * @notice Used by the market contract only:
   * Remove an account's lockup, making the FETH tokens available for transfer or withdrawal.
   * @dev Used by the market when an offer is invalidated, which occurs when an auction for the same NFT
   * receives its first bid or the buyer purchased the NFT another way, such as with `buy`.
   * @param account The account whose lockup is to be unlocked.
   * @param expiration The original lockup expiration for the tokens to be unlocked unlocked.
   * This will revert if the lockup has already expired.
   * @param amount The number of tokens to be unlocked from `account`.
   * This will revert if the tokens were previously unlocked.
   */
  function marketUnlockFor(
    address account,
    uint256 expiration,
    uint256 amount
  ) external onlyFoundationMarket {
    _marketUnlockFor(account, expiration, amount);
  }

  /**
   * @notice Used by the market contract only:
   * Removes tokens from the user's available balance and returns ETH to the caller.
   * @dev Used by the market when a user's available FETH balance is used to make a purchase
   * including accepting a buy price or a private sale, or placing a bid in an auction.
   * @param from The account whose available balance is to be withdrawn from.
   * @param amount The number of tokens to be deducted from `unlockFrom`'s available balance and transferred as ETH.
   * This will revert if the tokens were previously unlocked.
   */
  function marketWithdrawFrom(address from, uint256 amount) external onlyFoundationMarket {
    AccountInfo storage accountInfo = _freeFromEscrow(from);
    _deductBalanceFrom(accountInfo, amount);

    // With the external call after state changes, we do not need a nonReentrant guard
    payable(msg.sender).sendValue(amount);

    emit ETHWithdrawn(from, msg.sender, amount);
  }

  /**
   * @notice Used by the market contract only:
   * Removes a lockup from the user's account and then returns ETH to the caller.
   * @dev Used by the market to extract unexpired funds as ETH to distribute for
   * a sale when the user's offer is accepted.
   * @param account The account whose lockup is to be removed.
   * @param expiration The original lockup expiration for the tokens to be unlocked.
   * This will revert if the lockup has already expired.
   * @param amount The number of tokens to be unlocked and withdrawn as ETH.
   */
  function marketWithdrawLocked(
    address account,
    uint256 expiration,
    uint256 amount
  ) external onlyFoundationMarket {
    _removeFromLockedBalance(account, expiration, amount);

    // With the external call after state changes, we do not need a nonReentrant guard
    payable(msg.sender).sendValue(amount);

    emit ETHWithdrawn(account, msg.sender, amount);
  }

  /**
   * @notice Transfers an amount from your account.
   * @param to The address of the account which the tokens are transferred from.
   * @param amount The number of FETH tokens to be transferred.
   * @return success Always true (reverts if insufficient funds).
   */
  function transfer(address to, uint256 amount) external returns (bool success) {
    return transferFrom(msg.sender, to, amount);
  }

  /**
   * @notice Transfers an amount from the account specified if the `msg.sender` has approval.
   * @param from The address from which the available tokens are transferred from.
   * @param to The address to which the tokens are to be transferred.
   * @param amount The number of FETH tokens to be transferred.
   * @return success Always true (reverts if insufficient funds or not approved).
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public returns (bool success) {
    if (to == address(0)) {
      revert FETH_Transfer_To_Burn_Not_Allowed();
    } else if (to == address(this)) {
      revert FETH_Transfer_To_FETH_Not_Allowed();
    }
    AccountInfo storage fromAccountInfo = _freeFromEscrow(from);
    if (from != msg.sender) {
      _deductAllowanceFrom(fromAccountInfo, amount);
    }
    _deductBalanceFrom(fromAccountInfo, amount);
    AccountInfo storage toAccountInfo = accountToInfo[to];

    // Total ETH cannot realistically overflow 96 bits.
    unchecked {
      toAccountInfo.freedBalance += uint96(amount);
    }

    emit Transfer(from, to, amount);

    return true;
  }

  /**
   * @notice Withdraw all tokens available in your account and receive ETH.
   */
  function withdrawAvailableBalance() external {
    AccountInfo storage accountInfo = _freeFromEscrow(msg.sender);
    uint256 amount = accountInfo.freedBalance;
    if (amount == 0) {
      revert FETH_No_Funds_To_Withdraw();
    }
    delete accountInfo.freedBalance;

    // With the external call after state changes, we do not need a nonReentrant guard
    payable(msg.sender).sendValue(amount);

    emit ETHWithdrawn(msg.sender, msg.sender, amount);
  }

  /**
   * @notice Withdraw the specified number of tokens from the `from` accounts available balance
   * and send ETH to the destination address, if the `msg.sender` has approval.
   * @param from The address from which the available funds are to be withdrawn.
   * @param to The destination address for the ETH to be transferred to.
   * @param amount The number of tokens to be withdrawn and transferred as ETH.
   */
  function withdrawFrom(
    address from,
    address payable to,
    uint256 amount
  ) external {
    if (amount == 0) {
      revert FETH_No_Funds_To_Withdraw();
    }
    AccountInfo storage accountInfo = _freeFromEscrow(from);
    if (from != msg.sender) {
      _deductAllowanceFrom(accountInfo, amount);
    }
    _deductBalanceFrom(accountInfo, amount);

    // With the external call after state changes, we do not need a nonReentrant guard
    to.sendValue(amount);

    emit ETHWithdrawn(from, to, amount);
  }

  /**
   * @dev Require msg.sender has been approved and deducts the amount from the available allowance.
   */
  function _deductAllowanceFrom(AccountInfo storage accountInfo, uint256 amount) private {
    if (accountInfo.allowance[msg.sender] != type(uint256).max) {
      if (accountInfo.allowance[msg.sender] < amount) {
        revert FETH_Insufficient_Allowance(accountInfo.allowance[msg.sender]);
      }
      // The check above ensures allowance cannot underflow.
      unchecked {
        accountInfo.allowance[msg.sender] -= amount;
      }
    }
  }

  /**
   * @dev Removes an amount from the account's available FETH balance.
   */
  function _deductBalanceFrom(AccountInfo storage accountInfo, uint256 amount) private {
    // Free from escrow in order to consider any expired escrow balance
    if (accountInfo.freedBalance < amount) {
      revert FETH_Insufficient_Available_Funds(accountInfo.freedBalance);
    }
    // The check above ensures balance cannot underflow.
    unchecked {
      accountInfo.freedBalance -= uint96(amount);
    }
  }

  /**
   * @dev Moves expired escrow to the available balance.
   */
  function _freeFromEscrow(address account) private returns (AccountInfo storage) {
    AccountInfo storage accountInfo = accountToInfo[account];
    uint256 escrowIndex = accountInfo.lockupStartIndex;
    LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);

    // If the first bucket (the oldest) is empty or not yet expired, no change to escrowStartIndex is required
    if (escrow.expiration == 0 || escrow.expiration >= block.timestamp) {
      return accountInfo;
    }

    while (true) {
      // Total ETH cannot realistically overflow 96 bits.
      unchecked {
        accountInfo.freedBalance += escrow.totalAmount;
        accountInfo.lockups.del(escrowIndex);
        // Escrow index cannot overflow 32 bits.
        escrow = accountInfo.lockups.get(escrowIndex + 1);
      }

      // If the next bucket is empty, the start index is set to the previous bucket
      if (escrow.expiration == 0) {
        break;
      }

      // Escrow index cannot overflow 32 bits.
      unchecked {
        // Increment the escrow start index if the next bucket is not empty
        ++escrowIndex;
      }

      // If the next bucket is expired, that's the new start index
      if (escrow.expiration >= block.timestamp) {
        break;
      }
    }

    // Escrow index cannot overflow 32 bits.
    unchecked {
      accountInfo.lockupStartIndex = uint32(escrowIndex);
    }
    return accountInfo;
  }

  /**
   * @notice Lockup an account's FETH tokens for 24-25 hours.
   */
  /* solhint-disable-next-line code-complexity */
  function _marketLockupFor(address account, uint256 amount) private returns (uint256 expiration) {
    if (account == address(0)) {
      revert FETH_Cannot_Deposit_For_Lockup_With_Address_Zero();
    }
    if (amount == 0) {
      revert FETH_Must_Lockup_Non_Zero_Amount();
    }

    // Block timestamp in seconds is small enough to never overflow
    unchecked {
      // Lockup expires after 24 hours, rounded up to the next hour for a total of [24-25) hours
      expiration = lockupDuration + block.timestamp.ceilDiv(lockupInterval) * lockupInterval;
    }

    // Update available escrow
    // Always free from escrow to ensure the max bucket count is <= 25
    AccountInfo storage accountInfo = _freeFromEscrow(account);
    if (msg.value < amount) {
      // The check above prevents underflow with delta.
      unchecked {
        uint256 delta = amount - msg.value;
        if (accountInfo.freedBalance < delta) {
          revert FETH_Insufficient_Available_Funds(accountInfo.freedBalance);
        }
        // The check above prevents underflow of freed balance.
        accountInfo.freedBalance -= uint96(delta);
      }
    } else if (msg.value != amount) {
      // There's no reason to send msg.value more than the amount being locked up
      revert FETH_Too_Much_ETH_Provided();
    }

    // Add to locked escrow
    unchecked {
      // The number of buckets is always < 256 bits.
      for (uint256 escrowIndex = accountInfo.lockupStartIndex; ; ++escrowIndex) {
        LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == 0) {
          if (expiration > type(uint32).max) {
            revert FETH_Expiration_Too_Far_In_Future();
          }
          // Amount (ETH) will always be < 96 bits.
          accountInfo.lockups.set(escrowIndex, expiration, amount);
          break;
        }
        if (escrow.expiration == expiration) {
          // Total ETH will always be < 96 bits.
          accountInfo.lockups.setTotalAmount(escrowIndex, escrow.totalAmount + amount);
          break;
        }
      }
    }

    emit BalanceLocked(account, expiration, amount, msg.value);
  }

  /**
   * @notice Remove an account's lockup, making the FETH tokens available for transfer or withdrawal.
   */
  function _marketUnlockFor(
    address account,
    uint256 expiration,
    uint256 amount
  ) private {
    AccountInfo storage accountInfo = _removeFromLockedBalance(account, expiration, amount);
    // Total ETH cannot realistically overflow 96 bits.
    unchecked {
      accountInfo.freedBalance += uint96(amount);
    }
  }

  /**
   * @dev Removes the specified amount from locked escrow, potentially before its expiration.
   */
  /* solhint-disable-next-line code-complexity */
  function _removeFromLockedBalance(
    address account,
    uint256 expiration,
    uint256 amount
  ) private returns (AccountInfo storage) {
    if (expiration < block.timestamp) {
      revert FETH_Escrow_Expired();
    }

    AccountInfo storage accountInfo = accountToInfo[account];
    uint256 escrowIndex = accountInfo.lockupStartIndex;
    LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);

    if (escrow.expiration == expiration) {
      // If removing from the first bucket, we may be able to delete it
      if (escrow.totalAmount == amount) {
        accountInfo.lockups.del(escrowIndex);

        // Bump the escrow start index unless it's the last one
        if (accountInfo.lockups.get(escrowIndex + 1).expiration != 0) {
          // The number of escrow buckets will never overflow 32 bits.
          unchecked {
            ++accountInfo.lockupStartIndex;
          }
        }
      } else {
        if (escrow.totalAmount < amount) {
          revert FETH_Insufficient_Escrow(escrow.totalAmount);
        }
        // The require above ensures balance will not underflow.
        unchecked {
          accountInfo.lockups.setTotalAmount(escrowIndex, escrow.totalAmount - amount);
        }
      }
    } else {
      // Removing from the 2nd+ bucket
      while (true) {
        // The number of escrow buckets will never overflow 32 bits.
        unchecked {
          ++escrowIndex;
        }
        escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == expiration) {
          if (amount > escrow.totalAmount) {
            revert FETH_Insufficient_Escrow(escrow.totalAmount);
          }
          // The require above ensures balance will not underflow.
          unchecked {
            accountInfo.lockups.setTotalAmount(escrowIndex, escrow.totalAmount - amount);
          }
          // We may have an entry with 0 totalAmount but expiration will be set
          break;
        }
        if (escrow.expiration == 0) {
          revert FETH_Escrow_Not_Found();
        }
      }
    }

    emit BalanceUnlocked(account, expiration, amount);
    return accountInfo;
  }

  /**
   * @notice Returns the amount which a spender is still allowed to transact from the `account`'s balance.
   * @param account The owner of the funds.
   * @param operator The address with approval to spend from the `account`'s balance.
   * @return amount The number of tokens the `operator` is still allowed to transact with.
   */
  function allowance(address account, address operator) external view returns (uint256 amount) {
    AccountInfo storage accountInfo = accountToInfo[account];
    return accountInfo.allowance[operator];
  }

  /**
   * @notice Returns the balance of an account which is available to transfer or withdraw.
   * @dev This will automatically increase as soon as locked tokens reach their expiry date.
   * @param account The account to query the available balance of.
   * @return balance The available balance of the account.
   */
  function balanceOf(address account) external view returns (uint256 balance) {
    AccountInfo storage accountInfo = accountToInfo[account];
    balance = accountInfo.freedBalance;

    // Total ETH cannot realistically overflow 96 bits and escrowIndex will always be < 256 bits.
    unchecked {
      // Add expired lockups
      for (uint256 escrowIndex = accountInfo.lockupStartIndex; ; ++escrowIndex) {
        LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == 0 || escrow.expiration >= block.timestamp) {
          break;
        }
        balance += escrow.totalAmount;
      }
    }
  }

  /**
   * @notice Gets the Foundation market address which has permissions to manage lockups.
   * @return market The Foundation market contract address.
   */
  function getFoundationMarket() external view returns (address market) {
    return foundationMarket;
  }

  /**
   * @notice Returns the balance and each outstanding (unexpired) lockup bucket for an account, grouped by expiry.
   * @dev `expires.length` == `amounts.length`
   * and `amounts[i]` is the number of tokens which will expire at `expires[i]`.
   * The results returned are sorted by expiry, with the earliest expiry date first.
   * @param account The account to query the locked balance of.
   * @return expiries The time at which each outstanding lockup bucket expires.
   * @return amounts The number of FETH tokens which will expire for each outstanding lockup bucket.
   */
  function getLockups(address account) external view returns (uint256[] memory expiries, uint256[] memory amounts) {
    AccountInfo storage accountInfo = accountToInfo[account];

    // Count lockups
    uint256 lockedCount;
    // The number of buckets is always < 256 bits.
    unchecked {
      for (uint256 escrowIndex = accountInfo.lockupStartIndex; ; ++escrowIndex) {
        LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == 0) {
          break;
        }
        if (escrow.expiration >= block.timestamp && escrow.totalAmount > 0) {
          // Lockup count will never overflow 256 bits.
          ++lockedCount;
        }
      }
    }

    // Allocate arrays
    expiries = new uint256[](lockedCount);
    amounts = new uint256[](lockedCount);

    // Populate results
    uint256 i;
    // The number of buckets is always < 256 bits.
    unchecked {
      for (uint256 escrowIndex = accountInfo.lockupStartIndex; ; ++escrowIndex) {
        LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == 0) {
          break;
        }
        if (escrow.expiration >= block.timestamp && escrow.totalAmount > 0) {
          expiries[i] = escrow.expiration;
          amounts[i] = escrow.totalAmount;
          ++i;
        }
      }
    }
  }

  /**
   * @notice Returns the total balance of an account, including locked FETH tokens.
   * @dev Use `balanceOf` to get the number of tokens available for transfer or withdrawal.
   * @param account The account to query the total balance of.
   * @return balance The total FETH balance tracked for this account.
   */
  function totalBalanceOf(address account) external view returns (uint256 balance) {
    AccountInfo storage accountInfo = accountToInfo[account];
    balance = accountInfo.freedBalance;

    // Total ETH cannot realistically overflow 96 bits and escrowIndex will always be < 256 bits.
    unchecked {
      // Add all lockups
      for (uint256 escrowIndex = accountInfo.lockupStartIndex; ; ++escrowIndex) {
        LockedBalance.Lockup memory escrow = accountInfo.lockups.get(escrowIndex);
        if (escrow.expiration == 0) {
          break;
        }
        balance += escrow.totalAmount;
      }
    }
  }

  /**
   * @notice Returns the total amount of ETH locked in this contract.
   * @return supply The total amount of ETH locked in this contract.
   */
  function totalSupply() external view returns (uint256 supply) {
    /* It is possible for this to diverge from the total token count by transferring ETH on self destruct
       but this is on-par with the WETH implementation and done for gas savings. */
    return address(this).balance;
  }
}
