// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Fund.sol";
import "./Lending.sol";
import "./RoleAware.sol";
import "./MarginRouter.sol";
import "./PriceAware.sol";

// Goal: all external functions only accessible to margintrader role
// except for view functions of course

struct CrossMarginAccount {
    uint256 lastDepositBlock;
    address[] borrowTokens;
    // borrowed token address => amount
    mapping(address => uint256) borrowed;
    // borrowed token => yield quotient
    mapping(address => uint256) borrowedYieldQuotientsFP;
    address[] holdingTokens;
    // token held in portfolio => amount
    mapping(address => uint256) holdings;
    // boolean value of whether an account holds a token
    mapping(address => bool) holdsToken;
}

abstract contract CrossMarginAccounts is RoleAware, PriceAware {
    /// @dev gets used in calculating how much accounts can borrow
    uint256 public leveragePercent;

    /// @dev percentage of assets held per assets borrowed at which to liquidate
    uint256 public liquidationThresholdPercent;

    /// @dev record of all cross margin accounts
    mapping(address => CrossMarginAccount) internal marginAccounts;
    /// @dev total token caps
    mapping(address => uint256) public tokenCaps;
    /// @dev tracks total of short positions per token
    mapping(address => uint256) public totalShort;
    /// @dev tracks total of long positions per token
    mapping(address => uint256) public totalLong;
    uint256 public coolingOffPeriod;

    /// @dev last time this account deposited
    /// relevant for withdrawal window
    function getLastDepositBlock(address trader)
        external
        view
        returns (uint256)
    {
        return marginAccounts[trader].lastDepositBlock;
    }

    /// @dev add an asset to be held by account
    function addHolding(
        CrossMarginAccount storage account,
        address token,
        uint256 depositAmount
    ) internal {
        if (!hasHoldingToken(account, token)) {
            account.holdingTokens.push(token);
        }

        account.holdings[token] += depositAmount;
    }

    /// @dev adjust account to reflect borrowing of token amount
    function borrow(
        CrossMarginAccount storage account,
        address borrowToken,
        uint256 borrowAmount
    ) internal {
        if (!hasBorrowedToken(account, borrowToken)) {
            account.borrowTokens.push(borrowToken);
        } else {
            account.borrowed[borrowToken] = Lending(lending())
                .applyBorrowInterest(
                account.borrowed[borrowToken],
                borrowToken,
                account.borrowedYieldQuotientsFP[borrowToken]
            );
        }
        account.borrowedYieldQuotientsFP[borrowToken] = Lending(lending())
            .viewBorrowingYieldFP(borrowToken);

        account.borrowed[borrowToken] += borrowAmount;
        addHolding(account, borrowToken, borrowAmount);

        require(positiveBalance(account), "Can't borrow: insufficient balance");
    }

    /// @dev checks whether account is in the black, deposit + earnings relative to borrowed
    function positiveBalance(CrossMarginAccount storage account)
        internal
        returns (bool)
    {
        uint256 loan = loanInPeg(account, false);
        uint256 holdings = holdingsInPeg(account, false);
        // The following condition should hold:
        // holdings / loan >= leveragePercent / (leveragePercent - 100)
        // =>
        return holdings * (leveragePercent - 100) >= loan * leveragePercent;
    }

    /// @dev internal function adjusting holding and borrow balances when debt extinguished
    function extinguishDebt(
        CrossMarginAccount storage account,
        address debtToken,
        uint256 extinguishAmount
    ) internal {
        // will throw if insufficient funds
        account.borrowed[debtToken] = Lending(lending()).applyBorrowInterest(
            account.borrowed[debtToken],
            debtToken,
            account.borrowedYieldQuotientsFP[debtToken]
        );

        account.borrowed[debtToken] =
            account.borrowed[debtToken] -
            extinguishAmount;
        account.holdings[debtToken] =
            account.holdings[debtToken] -
            extinguishAmount;

        if (account.borrowed[debtToken] > 0) {
            account.borrowedYieldQuotientsFP[debtToken] = Lending(lending())
                .viewBorrowingYieldFP(debtToken);
        } else {
            delete account.borrowedYieldQuotientsFP[debtToken];

            bool decrement = false;
            uint256 len = account.borrowTokens.length;
            for (uint256 i; len > i; i++) {
                address currToken = account.borrowTokens[i];
                if (currToken == debtToken) {
                    decrement = true;
                } else if (decrement) {
                    account.borrowTokens[i - 1] = currToken;
                }
            }
            account.borrowTokens.pop();
        }
    }

    /// @dev checks whether an account holds a token
    function hasHoldingToken(CrossMarginAccount storage account, address token)
        internal
        view
        returns (bool)
    {
        return account.holdsToken[token];
    }

    /// @dev checks whether an account has borrowed a token
    function hasBorrowedToken(CrossMarginAccount storage account, address token)
        internal
        view
        returns (bool)
    {
        return account.borrowedYieldQuotientsFP[token] > 0;
    }

    /// @dev calculate total loan in reference currency, including compound interest
    function loanInPeg(CrossMarginAccount storage account, bool forceCurBlock)
        internal
        returns (uint256)
    {
        return
            sumTokensInPegWithYield(
                account.borrowTokens,
                account.borrowed,
                account.borrowedYieldQuotientsFP,
                forceCurBlock
            );
    }

    /// @dev total of assets of account, expressed in reference currency
    function holdingsInPeg(
        CrossMarginAccount storage account,
        bool forceCurBlock
    ) internal returns (uint256) {
        return
            sumTokensInPeg(
                account.holdingTokens,
                account.holdings,
                forceCurBlock
            );
    }

    /// @dev check whether an account can/should be liquidated
    function belowMaintenanceThreshold(CrossMarginAccount storage account)
        internal
        returns (bool)
    {
        uint256 loan = loanInPeg(account, true);
        uint256 holdings = holdingsInPeg(account, true);
        // The following should hold:
        // holdings / loan >= 1.1
        // => holdings >= loan * 1.1
        return 100 * holdings >= liquidationThresholdPercent * loan;
    }

    /// @dev go through list of tokens and their amounts, summing up
    function sumTokensInPeg(
        address[] storage tokens,
        mapping(address => uint256) storage amounts,
        bool forceCurBlock
    ) internal returns (uint256 totalPeg) {
        uint256 len = tokens.length;
        for (uint256 tokenId; tokenId < len; tokenId++) {
            address token = tokens[tokenId];
            totalPeg += PriceAware.getCurrentPriceInPeg(
                token,
                amounts[token],
                forceCurBlock
            );
        }
    }

    /// @dev go through list of tokens and their amounts, summing up
    function viewTokensInPeg(
        address[] storage tokens,
        mapping(address => uint256) storage amounts
    ) internal view returns (uint256 totalPeg) {
        uint256 len = tokens.length;
        for (uint256 tokenId; tokenId < len; tokenId++) {
            address token = tokens[tokenId];
            totalPeg += PriceAware.viewCurrentPriceInPeg(token, amounts[token]);
        }
    }

    /// @dev go through list of tokens and ammounts, summing up with interest
    function sumTokensInPegWithYield(
        address[] storage tokens,
        mapping(address => uint256) storage amounts,
        mapping(address => uint256) storage yieldQuotientsFP,
        bool forceCurBlock
    ) internal returns (uint256 totalPeg) {
        uint256 len = tokens.length;
        for (uint256 tokenId; tokenId < len; tokenId++) {
            address token = tokens[tokenId];
            totalPeg += yieldTokenInPeg(
                token,
                amounts[token],
                yieldQuotientsFP,
                forceCurBlock
            );
        }
    }

    /// @dev go through list of tokens and ammounts, summing up with interest
    function viewTokensInPegWithYield(
        address[] storage tokens,
        mapping(address => uint256) storage amounts,
        mapping(address => uint256) storage yieldQuotientsFP
    ) internal view returns (uint256 totalPeg) {
        uint256 len = tokens.length;
        for (uint256 tokenId; tokenId < len; tokenId++) {
            address token = tokens[tokenId];
            totalPeg += viewYieldTokenInPeg(
                token,
                amounts[token],
                yieldQuotientsFP
            );
        }
    }

    /// @dev calculate yield for token amount and convert to reference currency
    function yieldTokenInPeg(
        address token,
        uint256 amount,
        mapping(address => uint256) storage yieldQuotientsFP,
        bool forceCurBlock
    ) internal returns (uint256) {
        uint256 yieldFP = Lending(lending()).viewBorrowingYieldFP(token);
        // 1 * FP / FP = 1
        uint256 amountInToken = (amount * yieldFP) / yieldQuotientsFP[token];
        return
            PriceAware.getCurrentPriceInPeg(
                token,
                amountInToken,
                forceCurBlock
            );
    }

    /// @dev calculate yield for token amount and convert to reference currency
    function viewYieldTokenInPeg(
        address token,
        uint256 amount,
        mapping(address => uint256) storage yieldQuotientsFP
    ) internal view returns (uint256) {
        uint256 yieldFP = Lending(lending()).viewBorrowingYieldFP(token);
        // 1 * FP / FP = 1
        uint256 amountInToken = (amount * yieldFP) / yieldQuotientsFP[token];
        return PriceAware.viewCurrentPriceInPeg(token, amountInToken);
    }

    /// @dev move tokens from one holding to another
    function adjustAmounts(
        CrossMarginAccount storage account,
        address fromToken,
        address toToken,
        uint256 soldAmount,
        uint256 boughtAmount
    ) internal {
        account.holdings[fromToken] = account.holdings[fromToken] - soldAmount;
        addHolding(account, toToken, boughtAmount);
    }

    /// sets borrow and holding to zero
    function deleteAccount(CrossMarginAccount storage account) internal {
        uint256 len = account.borrowTokens.length;
        for (uint256 borrowIdx; len > borrowIdx; borrowIdx++) {
            address borrowToken = account.borrowTokens[borrowIdx];
            totalShort[borrowToken] -= account.borrowed[borrowToken];
            account.borrowed[borrowToken] = 0;
            account.borrowedYieldQuotientsFP[borrowToken] = 0;
        }
        len = account.holdingTokens.length;
        for (uint256 holdingIdx; len > holdingIdx; holdingIdx++) {
            address holdingToken = account.holdingTokens[holdingIdx];
            totalLong[holdingToken] -= account.holdings[holdingToken];
            account.holdings[holdingToken] = 0;
            account.holdsToken[holdingToken] = false;
        }
        delete account.borrowTokens;
        delete account.holdingTokens;
    }

    /// @dev minimum
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }
}
