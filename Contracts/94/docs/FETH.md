# FETH



> An ERC-20 token which wraps ETH, potentially with a 1 day lockup period.

FETH is an [ERC-20 token](https://eips.ethereum.org/EIPS/eip-20) modeled after [WETH9](https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code). It has the added ability to lockup tokens for 24-25 hours - during this time they may not be transferred or withdrawn, except by our market contract which requested the lockup in the first place.

*Locked balances are rounded up to the next hour. They are grouped by the expiration time of the lockup into what we refer to as a lockup &quot;bucket&quot;. At any time there may be up to 25 buckets but never more than that which prevents loops from exhausting gas limits.*

## Methods

### allowance

```solidity
function allowance(address account, address operator) external view returns (uint256 amount)
```

Returns the amount which a spender is still allowed to transact from the `account`&#39;s balance.



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The owner of the funds.
| operator | address | The address with approval to spend from the `account`&#39;s balance.

#### Returns

| Name | Type | Description |
|---|---|---|
| amount | uint256 | The number of tokens the `operator` is still allowed to transact with.

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool success)
```

Approves a `spender` as an operator with permissions to transfer from your account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | The address of the operator account that has approval to spend funds from the `msg.sender`&#39;s account.
| amount | uint256 | The max number of FETH tokens from `msg.sender`&#39;s account that this spender is allowed to transact with.

#### Returns

| Name | Type | Description |
|---|---|---|
| success | bool | Always true.

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256 balance)
```

Returns the balance of an account which is available to transfer or withdraw.

*This will automatically increase as soon as locked tokens reach their expiry date.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to query the available balance of.

#### Returns

| Name | Type | Description |
|---|---|---|
| balance | uint256 | The available balance of the account.

### decimals

```solidity
function decimals() external view returns (uint8)
```

The number of decimals the token uses.

*This method can be used to improve usability when displaying token amounts, but all interactions with this contract use whole amounts not considering decimals.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | 18

### deposit

```solidity
function deposit() external payable
```

Deposit ETH (via `msg.value`) and receive the equivalent amount in FETH tokens. These tokens are not subject to any lockup period.




### depositFor

```solidity
function depositFor(address account) external payable
```

Deposit ETH (via `msg.value`) and credit the `account` provided with the equivalent amount in FETH tokens. These tokens are not subject to any lockup period.

*This may be used by the Foundation market to credit a user&#39;s account with FETH tokens.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to credit with FETH tokens.

### getFoundationMarket

```solidity
function getFoundationMarket() external view returns (address market)
```

Gets the Foundation market address which has permissions to manage lockups.




#### Returns

| Name | Type | Description |
|---|---|---|
| market | address | The Foundation market contract address.

### getLockups

```solidity
function getLockups(address account) external view returns (uint256[] expiries, uint256[] amounts)
```

Returns the balance and each outstanding (unexpired) lockup bucket for an account, grouped by expiry.

*`expires.length` == `amounts.length` and `amounts[i]` is the number of tokens which will expire at `expires[i]`. The results returned are sorted by expiry, with the earliest expiry date first.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to query the locked balance of.

#### Returns

| Name | Type | Description |
|---|---|---|
| expiries | uint256[] | The time at which each outstanding lockup bucket expires.
| amounts | uint256[] | The number of FETH tokens which will expire for each outstanding lockup bucket.

### marketChangeLockup

```solidity
function marketChangeLockup(address unlockFrom, uint256 unlockExpiration, uint256 unlockAmount, address lockupFor, uint256 lockupAmount) external payable returns (uint256 expiration)
```

Used by the market contract only: Remove an account&#39;s lockup and then create a new lockup, potentially for a different account.

*Used by the market when an offer for an NFT is increased. This may be for a single account (increasing their offer) or two different accounts (outbidding someone elses offer).*

#### Parameters

| Name | Type | Description |
|---|---|---|
| unlockFrom | address | The account whose lockup is to be removed.
| unlockExpiration | uint256 | The original lockup expiration for the tokens to be unlocked. This will revert if the lockup has already expired.
| unlockAmount | uint256 | The number of tokens to be unlocked from `unlockFrom`&#39;s account. This will revert if the tokens were previously unlocked.
| lockupFor | address | The account to which the funds are to be deposited for (via the `msg.value`) and tokens locked up.
| lockupAmount | uint256 | The number of tokens to be locked up for the `lockupFor`&#39;s account. `msg.value` must be &lt;= `lockupAmount` and any delta will be taken from the account&#39;s available FETH balance.

#### Returns

| Name | Type | Description |
|---|---|---|
| expiration | uint256 | The expiration timestamp for the FETH tokens that were locked.

### marketLockupFor

```solidity
function marketLockupFor(address account, uint256 amount) external payable returns (uint256 expiration)
```

Used by the market contract only: Lockup an account&#39;s FETH tokens for 24-25 hours.

*Used by the market when a new offer for an NFT is made.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to which the funds are to be deposited for (via the `msg.value`) and tokens locked up.
| amount | uint256 | The number of tokens to be locked up for the `lockupFor`&#39;s account. `msg.value` must be &lt;= `amount` and any delta will be taken from the account&#39;s available FETH balance.

#### Returns

| Name | Type | Description |
|---|---|---|
| expiration | uint256 | The expiration timestamp for the FETH tokens that were locked.

### marketUnlockFor

```solidity
function marketUnlockFor(address account, uint256 expiration, uint256 amount) external nonpayable
```

Used by the market contract only: Remove an account&#39;s lockup, making the FETH tokens available for transfer or withdrawal.

*Used by the market when an offer is invalidated, which occurs when an auction for the same NFT receives its first bid or the buyer purchased the NFT another way, such as with `buy`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account whose lockup is to be unlocked.
| expiration | uint256 | The original lockup expiration for the tokens to be unlocked unlocked. This will revert if the lockup has already expired.
| amount | uint256 | The number of tokens to be unlocked from `account`. This will revert if the tokens were previously unlocked.

### marketWithdrawFrom

```solidity
function marketWithdrawFrom(address from, uint256 amount) external nonpayable
```

Used by the market contract only: Removes tokens from the user&#39;s available balance and returns ETH to the caller.

*Used by the market when a user&#39;s available FETH balance is used to make a purchase including accepting a buy price or a private sale, or placing a bid in an auction.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | The account whose available balance is to be withdrawn from.
| amount | uint256 | The number of tokens to be deducted from `unlockFrom`&#39;s available balance and transferred as ETH. This will revert if the tokens were previously unlocked.

### marketWithdrawLocked

```solidity
function marketWithdrawLocked(address account, uint256 expiration, uint256 amount) external nonpayable
```

Used by the market contract only: Removes a lockup from the user&#39;s account and then returns ETH to the caller.

*Used by the market to extract unexpired funds as ETH to distribute for a sale when the user&#39;s offer is accepted.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account whose lockup is to be removed.
| expiration | uint256 | The original lockup expiration for the tokens to be unlocked. This will revert if the lockup has already expired.
| amount | uint256 | The number of tokens to be unlocked and withdrawn as ETH.

### name

```solidity
function name() external view returns (string)
```

The name of the token.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | Foundation Wrapped Ether

### symbol

```solidity
function symbol() external view returns (string)
```

The symbol of the token.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | FETH

### totalBalanceOf

```solidity
function totalBalanceOf(address account) external view returns (uint256 balance)
```

Returns the total balance of an account, including locked FETH tokens.

*Use `balanceOf` to get the number of tokens available for transfer or withdrawal.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | The account to query the total balance of.

#### Returns

| Name | Type | Description |
|---|---|---|
| balance | uint256 | The total FETH balance tracked for this account.

### totalSupply

```solidity
function totalSupply() external view returns (uint256 supply)
```

Returns the total amount of ETH locked in this contract.




#### Returns

| Name | Type | Description |
|---|---|---|
| supply | uint256 | The total amount of ETH locked in this contract.

### transfer

```solidity
function transfer(address to, uint256 amount) external nonpayable returns (bool success)
```

Transfers an amount from your account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | The address of the account which the tokens are transferred from.
| amount | uint256 | The number of FETH tokens to be transferred.

#### Returns

| Name | Type | Description |
|---|---|---|
| success | bool | Always true (reverts if insufficient funds).

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) external nonpayable returns (bool success)
```

Transfers an amount from the account specified if the `msg.sender` has approval.



#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | The address from which the available tokens are transferred from.
| to | address | The address to which the tokens are to be transferred.
| amount | uint256 | The number of FETH tokens to be transferred.

#### Returns

| Name | Type | Description |
|---|---|---|
| success | bool | Always true (reverts if insufficient funds or not approved).

### withdrawAvailableBalance

```solidity
function withdrawAvailableBalance() external nonpayable
```

Withdraw all tokens available in your account and receive ETH.




### withdrawFrom

```solidity
function withdrawFrom(address from, address payable to, uint256 amount) external nonpayable
```

Withdraw the specified number of tokens from the `from` accounts available balance and send ETH to the destination address, if the `msg.sender` has approval.



#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | The address from which the available funds are to be withdrawn.
| to | address payable | The destination address for the ETH to be transferred to.
| amount | uint256 | The number of tokens to be withdrawn and transferred as ETH.



## Events

### Approval

```solidity
event Approval(address indexed from, address indexed spender, uint256 amount)
```

Emitted when the allowance for a spender account is updated.



#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | The account the spender is authorized to transact for. |
| spender `indexed` | address | The account with permissions to manage FETH tokens for the `from` account. |
| amount  | uint256 | The max amount of tokens which can be spent by the `spender` account. |

### BalanceLocked

```solidity
event BalanceLocked(address indexed account, uint256 indexed expiration, uint256 amount, uint256 valueDeposited)
```

Emitted when FETH tokens are locked up by the Foundation market for 24-25 hours and may include newly deposited ETH which is added to the account&#39;s total FETH balance.



#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | The account which has access to the FETH after the `expiration`. |
| expiration `indexed` | uint256 | The time at which the `from` account will have access to the locked FETH. |
| amount  | uint256 | The number of FETH tokens which where locked up. |
| valueDeposited  | uint256 | The amount of ETH added to their account&#39;s total FETH balance, this may be lower than `amount` if available FETH was leveraged. |

### BalanceUnlocked

```solidity
event BalanceUnlocked(address indexed account, uint256 indexed expiration, uint256 amount)
```

Emitted when FETH tokens are unlocked by the Foundation market.

*This event will not be emitted when lockups expire, it&#39;s only for tokens which are unlocked before their expiry.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account `indexed` | address | The account which had locked FETH freed before expiration. |
| expiration `indexed` | uint256 | The time this balance was originally scheduled to be unlocked. |
| amount  | uint256 | The number of FETH tokens which were unlocked. |

### ETHWithdrawn

```solidity
event ETHWithdrawn(address indexed from, address indexed to, uint256 amount)
```

Emitted when ETH is withdrawn from a user&#39;s account.

*This may be triggered by the user, an approved operator, or the Foundation market.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | The account from which FETH was deducted in order to send the ETH. |
| to `indexed` | address | The address the ETH was sent to. |
| amount  | uint256 | The number of tokens which were deducted from the user&#39;s FETH balance and transferred as ETH. |

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 amount)
```

Emitted when a transfer of FETH tokens is made from one account to another.



#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | The account which is sending FETH tokens. |
| to `indexed` | address | The account which is receiving FETH tokens. |
| amount  | uint256 | The number of FETH tokens which were sent. |



## Errors

### FETH_Cannot_Deposit_For_Lockup_With_Address_Zero

```solidity
error FETH_Cannot_Deposit_For_Lockup_With_Address_Zero()
```






### FETH_Escrow_Expired

```solidity
error FETH_Escrow_Expired()
```






### FETH_Escrow_Not_Found

```solidity
error FETH_Escrow_Not_Found()
```






### FETH_Expiration_Too_Far_In_Future

```solidity
error FETH_Expiration_Too_Far_In_Future()
```






### FETH_Insufficient_Allowance

```solidity
error FETH_Insufficient_Allowance(uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | The current allowed amount the spender is authorized to transact for this account. |

### FETH_Insufficient_Available_Funds

```solidity
error FETH_Insufficient_Available_Funds(uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | The current available (unlocked) token count of this account. |

### FETH_Insufficient_Escrow

```solidity
error FETH_Insufficient_Escrow(uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | The current number of tokens this account has for the given lockup expiry bucket. |

### FETH_Invalid_Lockup_Duration

```solidity
error FETH_Invalid_Lockup_Duration()
```






### FETH_Market_Must_Be_A_Contract

```solidity
error FETH_Market_Must_Be_A_Contract()
```






### FETH_Must_Deposit_Non_Zero_Amount

```solidity
error FETH_Must_Deposit_Non_Zero_Amount()
```






### FETH_Must_Lockup_Non_Zero_Amount

```solidity
error FETH_Must_Lockup_Non_Zero_Amount()
```






### FETH_No_Funds_To_Withdraw

```solidity
error FETH_No_Funds_To_Withdraw()
```






### FETH_Only_FND_Market_Allowed

```solidity
error FETH_Only_FND_Market_Allowed()
```






### FETH_Too_Much_ETH_Provided

```solidity
error FETH_Too_Much_ETH_Provided()
```






### FETH_Transfer_To_Burn_Not_Allowed

```solidity
error FETH_Transfer_To_Burn_Not_Allowed()
```






### FETH_Transfer_To_FETH_Not_Allowed

```solidity
error FETH_Transfer_To_FETH_Not_Allowed()
```







