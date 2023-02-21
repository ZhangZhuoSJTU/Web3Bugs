In this document, we present the process we use to classify bugs in our study, along with examples of ambiguous cases. We also provide a description of each bug label as a reference, which can be found at the end of this document.

It is important to note that classifying functional bugs can be a subjective process, and we welcome any suggestions for improving our classification standards.

# Process
To classify a bug, we follow these steps:

1. First, we validate whether the bug is within the scope of our study. Our focus is on exploitable bugs in smart contracts, so many bugs may be excluded. If the bug falls into any of the `O` categories, it is considered out of scope.
2. We then validate whether the bug can be found by tools with simple and generic testing oracles. To do so, we investigate how the bug is exploited. If any oracle mentioned by the `L` categories can detect the exploit, we classify it as an `L` bug. It is important to note that this is an over-approximation of current vulnerability detection techniques. As long as there is an oracle that can detect the exploit, we assume the detection tool can detect it (regardless of the tool's effectiveness). For example, we assume there is no path exploration issue for symbolic execution and any constraint can be solved in time.
3. Any bugs that remain after the previous steps are labeled as `S` bugs.
    1. We first investigate the root cause of the bug. If the root cause can be classified as `S1` to `S6`, we label it accordingly.
    2. For the remaining bugs, we investigate how they can be exploited. If the way of exploit matches any of the `SE` types, we label it accordingly.
    3. Any remaining bugs are labeled as `SC`.

# Ambiguous Cases


## Case 1: [Referrer can drain `ReferralFeePoolV0`](https://github.com/code-423n4/2021-10-mochi-findings/issues/55)

### Bug Description

function `claimRewardAsMochi` in `ReferralFeePoolV0.sol` did not reduce user reward balance, allowing referrer to claim the same reward repeatedly and thus draining the fee pool.

Did not reduce user reward balance at L28-47 in [ReferralFeePoolV0.sol](https://github.com/code-423n4/2021-10-mochi/blob/main/projects/mochi-core/contracts/feePool/ReferralFeePoolV0.sol)

To mitigate the issue, add the following lines

> rewards -= reward\[msg.sender];
>
> reward\[msg.sender] = 0;

### Explanation

We have classified this bug as __S3-1__ since the root cause is related to missing state update regarding `rewards` and `reward[msg.sender]`. While it may appear similar to __SE-3__ since the attacker needs to invoke the `claimRewardAsMochi` function repeatedly to exploit the bug, we followed our classification process and identified the root cause as __S3-1__.


## Case 2: [Miners Can Re-Roll the VRF Output to Game the Protocol](https://github.com/code-423n4/2021-10-pooltogether-findings/issues/56)

### Bug Description

Miners are able to rewrite a chain's history if they dislike the VRF output used by the protocol. Consider the following example:

+ A miner or well-funded user is participating in the PoolTogether protocol.
+ A VRF request is made and fulfilled in the same block.
+ The protocol participant does not benefit from the VRF output and therefore wants to increase their chances of winning by including the output in another block, producing an entirely new VRF output. This is done by re-orging the chain, i.e. following a new canonical chain where the VRF output has not been included in a block.
+ This attack can be continued as long as the attacker controls 51% of the network. The miner itself could control a much smaller proportion of the network and still be able to mine a few blocks in succession, although this is of low probability but entirely possible.
+ A well-funded user could also pay miners to re-org the chain on their behalf in the form of MEV to achieve the same benefit.
The PoolTogether team is aware of this issue but is yet to mitigate this attack vector fully.

### Explanation

We have classified this bug as __O7__, as we believe it is not specific to the subject project, but rather a general question of whether the security model of Chainlink's VRF can be trusted.

## Case 3: [Logic error in burnFlashGovernanceAsset can cause locked assets to be stolen](https://github.com/code-423n4/2022-01-behodler-findings/issues/305)

### Bug Description

A logic error in the `burnFlashGovernanceAsset` function that resets a user's `pendingFlashDecision` allows that user to steal other user's assets locked in future flash governance decisions. As a result, attackers can get their funds back even if they execute a malicious flash decision and the community burns their assets.

1. An attacker Alice executes a malicious flash governance decision, and her assets are locked in the `FlashGovernanceArbiter` contract.
2. The community disagrees with Alice's flash governance decision and calls `burnFlashGovernanceAsset` to burn her locked assets. However, the `burnFlashGovernanceAsset` function resets Alice's `pendingFlashDecision` to the default config (see line 134).
3. A benign user, Bob executes another flash governance decision, and his assets are locked in the contract.
4. Now, Alice calls `withdrawGovernanceAsset` to withdraw Bob's locked asset, effectively the same as stealing Bob's assets. Since Alice's `pendingFlashDecision` is reset to the default, the `unlockTime < block.timestamp` condition is fulfilled, and the withdrawal succeeds.

Referenced code:

+ DAO/FlashGovernanceArbiter.sol#L134
+ DAO/FlashGovernanceArbiter.sol#L146

To mitigate this issue, it is suggested to change line 134 to `delete pendingFlashDecision[targetContract][user]` instead of setting the `pendingFlashDecision` to the default.

### Explanation

The bug can be classified as either __S3-2__ or __S6-4__, but the root cause is related to the incorrect update of `pendingFlashDecision`, which is not an accounting issue. Therefore, we have classified this bug as __S3-2__.

## Case 4: [Controller does not raise an error when there's insufficient liquidity](https://github.com/code-423n4/2021-09-yaxis-findings/issues/28)

### Bug Description

When a user tries to withdraw the token from the vault, the vault would withdraw the token from the controller if there's insufficient liquidity in the vault. However, the controller does not raise an error when there's insufficient liquidity in the controller/ strategies. The user would lose his shares while getting nothing.

An MEV searcher could apply this attack on any withdrawal. When an attacker found an unconfirmed tx that tries to withdraw 1M dai, he can do such sandwich attack.

1. Deposits USDC into the vault.
2. Withdraw all dai left in the vault/controller/strategy.
3. Place the vitims tx here. The victim would get zero dai while burning 1 M share. This would pump the share price.
4. Withdraw all liquidity.

All users would be vulnerable to MEV attackers. I consider this is a high-risk issue.

To mitigate this issue, the following steps are recommended:

+ First, users pay the slippage when they try to withdraw. I do not find this fair. Users have to pay extra gas to withdraw liquidity from strategy, convert the token, and still paying the slippage. I recommend writing a view function for the frontend to display how much slippage the user has to pay. (Controler.sol#L448-L479)
+ Second, the controller does not revert the transaction there's insufficient liquidity. Recommend to revert the transaction when `_amount` is not equal to zero after the loop finish. (Controller.sol#L577-L622)

### Explanation

While this attack is launched through a sandwich attack, the root cause is not related to price changes, and as such, we do not classify it as __S1__. Instead, we classify it as __SC__ since there is no explicit category for this type of bug.


# Bug Labels

### Out-of-scope Bugs

These are bugs that fall outside the scope of our study and are thus not analyzed further.

+ __O1__: These vulnerabilities can only be exploited by privileged users (e.g., rug pull), or when the privileged users make mistakes (e.g., applying incorrect configuration during deployment).
+ __O2__: We cannot access the source code of the project.
+ __O3__: These vulnerabilities can only be exploited with further actions by victim users (e.g., [EIP-4626 inflation attacks](https://ethereum-magicians.org/t/address-eip-4626-inflation-attacks-with-virtual-shares-and-assets/12677))
+ __O4__: Bugs that occur in off-chain components.
+ __O5__: Typo or trivial bugs that render the contract non-deployable or non-functional. We believe these types of bugs are unlikely to occur in contracts that are ready for audit or have been deployed.
+ __O6__: Bugs that are not considered as such by the project. This can be due to disagreements between the auditors and the project (common in early contests), no explicit code affected by the bug, or intentional behavior that aligns with the business model (where the business model may be flawed).
+ __O7__: Doubtful findings, which we believe may be invalid, duplicated, or non-critical (common in early contests).

### Bugs with Simple and General Testing Oracles

These are bugs that can be detected using simple and general oracles and do not require an in-depth understanding of the code semantics.

+ __L1__: Reentrancy.
+ __L2__: Rounding issues or precision loss.
+ __L3__: Bugs that are caused by using uninitialized variables.
+ __L4__: Bugs that are caused by exceeding the gas limitation.
+ __L5__: Storage collision and confusion between proxy and implementation.
+ __L6__: Arbitrary external function call.
+ __L7__: Integer overflow and underflow.
+ __L8__: Revert issues caused by low-level calls or external libraries.
+ __L9__: Bugs that are caused by writing to memory that does not apply to the storage.
+ __LA__: Cryptographic issues.
+ __LB__: Using `tx.origin`.

### Bugs that Require High-level Semantical Oracles

These are bugs that require high-level semantical oracles to detect, as they arise from inconsistencies between the code implementation and the business model.

+ __S1__: Price oracle manipulation.
    + __S1-1__: AMM price oracle manipulation.
    + __S1-2__: Sandwich attack.
    + __S1-3__: Non-AMM price oracle manipulation.
+ __S2__: ID-related violations.
    + __S2-1__: ID can be arbitrarily set by users or lack of ID validation. ID can also be a project-specified variable (e.g., hash) or an address.
    + __S2-2__: Shared resource (e.g., token) without proper locks.
    + __S2-3__: ID uniqueness violation (i.e., an ID should be unique but it is not).
+ __S3__: Erroneous state updates.
    + __S3-1__: Missing state update.
    + __S3-2__: Incorrect state updates, e.g., a state update that should not be there.
+ __S4__: Business-flow atomicity violations.
    + __S4-1__: Lack of proper locks for a business flow consisting of multiple transactions.
+ __S5__: Privilege escalation and access control issues.
    + __S5-1__: Users can update privileged state variables arbitrarily (caused by lack of ID-unrelated input sanitization).
    + __S5-2__: Users can invoke some functions at a time they should not be able to do so.
    + __S5-3__: Privileged functions can be called by anyone or at any time.
+ __S6__: Erroneous accounting.
    + __S6-1__: Incorrect calculating order.
    + __S6-2__: Returning an unexpected value that deviates from the expected semantics specified for the contract.
    + __S6-3__: Calculations performed with incorrect numbers (e.g., `x = a + b` ==> `x = a + c`).
    + __S6-4__: Other accounting errors (e.g., `x = a + b` ==> `x = a - b`).
+ __SE__: Broken business models due to unexpected operations
    + __SE-1__: Unexpected function invocation sequences (e.g., external calls to dependent contracts).
    + __SE-2__: Unexpected environment or contract conditions (e.g., ChainLink returning outdated data or significant slippage occurring).
    + __SE-3__: A given function is invoked multiple times unexpectedly.
    + __SE-4__: Unexpected function arguments.
+ __SC__: Contract implementation-specific bugs. These bugs are difficult to categorize into the above categories.
