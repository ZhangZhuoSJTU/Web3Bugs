// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Fund.sol";
import "./Lending.sol";
import "./RoleAware.sol";
import "./MarginRouter.sol";
import "./CrossMarginLiquidation.sol";

// Goal: all external functions only accessible to margintrader role
// except for view functions of course

contract CrossMarginTrading is CrossMarginLiquidation, IMarginTrading {
    constructor(address _peg, address _roles)
        RoleAware(_roles)
        PriceAware(_peg)
    {
        liquidationThresholdPercent = 110;
        coolingOffPeriod = 20;
        leveragePercent = 300;
    }

    /// @dev admin function to set the token cap
    function setTokenCap(address token, uint256 cap) external {
        require(
            isTokenActivator(msg.sender),
            "Caller not authorized to set token cap"
        );
        tokenCaps[token] = cap;
    }

    /// @dev setter for cooling off period for withdrawing funds after deposit
    function setCoolingOffPeriod(uint256 blocks) external onlyOwner {
        coolingOffPeriod = blocks;
    }

    /// @dev admin function to set leverage
    function setLeverage(uint256 _leveragePercent) external onlyOwner {
        leveragePercent = _leveragePercent;
    }

    /// @dev admin function to set liquidation threshold
    function setLiquidationThresholdPercent(uint256 threshold)
        external
        onlyOwner
    {
        liquidationThresholdPercent = threshold;
    }

    /// @dev gets called by router to affirm a deposit to an account
    function registerDeposit(
        address trader,
        address token,
        uint256 depositAmount
    ) external override returns (uint256 extinguishableDebt) {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );

        CrossMarginAccount storage account = marginAccounts[trader];
        account.lastDepositBlock = block.number;

        if (account.borrowed[token] > 0) {
            extinguishableDebt = min(depositAmount, account.borrowed[token]);
            extinguishDebt(account, token, extinguishableDebt);
            totalShort[token] -= extinguishableDebt;
        }

        // no overflow because depositAmount >= extinguishableDebt
        uint256 addedHolding = depositAmount - extinguishableDebt;
        _registerDeposit(account, token, addedHolding);
    }

    function _registerDeposit(
        CrossMarginAccount storage account,
        address token,
        uint256 addedHolding
    ) internal {
        addHolding(account, token, addedHolding);

        totalLong[token] += addedHolding;
        require(
            tokenCaps[token] >= totalLong[token],
            "Exceeding global exposure cap to token -- try again later"
        );
    }

    /// @dev gets called by router to affirm borrowing event
    function registerBorrow(
        address trader,
        address borrowToken,
        uint256 borrowAmount
    ) external override {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );
        CrossMarginAccount storage account = marginAccounts[trader];
        _registerBorrow(account, borrowToken, borrowAmount);
    }

    function _registerBorrow(
        CrossMarginAccount storage account,
        address borrowToken,
        uint256 borrowAmount
    ) internal {
        totalShort[borrowToken] += borrowAmount;
        totalLong[borrowToken] += borrowAmount;
        require(
            tokenCaps[borrowToken] >= totalShort[borrowToken] &&
                tokenCaps[borrowToken] >= totalLong[borrowToken],
            "Exceeding global exposure cap to token -- try again later"
        );

        borrow(account, borrowToken, borrowAmount);
    }

    /// @dev gets called by router to affirm withdrawal of tokens from account
    function registerWithdrawal(
        address trader,
        address withdrawToken,
        uint256 withdrawAmount
    ) external override {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );
        CrossMarginAccount storage account = marginAccounts[trader];
        _registerWithdrawal(account, withdrawToken, withdrawAmount);
    }

    function _registerWithdrawal(
        CrossMarginAccount storage account,
        address withdrawToken,
        uint256 withdrawAmount
    ) internal {
        require(
            block.number > account.lastDepositBlock + coolingOffPeriod,
            "To prevent attacks you must wait until your cooling off period is over to withdraw"
        );

        totalLong[withdrawToken] -= withdrawAmount;
        // throws on underflow
        account.holdings[withdrawToken] =
            account.holdings[withdrawToken] -
            withdrawAmount;
        require(
            positiveBalance(account),
            "Account balance is too low to withdraw"
        );
    }

    /// @dev overcollateralized borrowing on a cross margin account, called by router
    function registerOvercollateralizedBorrow(
        address trader,
        address depositToken,
        uint256 depositAmount,
        address borrowToken,
        uint256 withdrawAmount
    ) external override {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );

        CrossMarginAccount storage account = marginAccounts[trader];

        _registerDeposit(account, depositToken, depositAmount);
        _registerBorrow(account, borrowToken, withdrawAmount);
        _registerWithdrawal(account, borrowToken, withdrawAmount);

        account.lastDepositBlock = block.number;
    }

    /// @dev gets called by router to register a trade and borrow and extinguish as necessary
    function registerTradeAndBorrow(
        address trader,
        address tokenFrom,
        address tokenTo,
        uint256 inAmount,
        uint256 outAmount
    )
        external
        override
        returns (uint256 extinguishableDebt, uint256 borrowAmount)
    {
        require(
            isMarginTrader(msg.sender),
            "Calling contract is not an authorized margin trader agent"
        );

        CrossMarginAccount storage account = marginAccounts[trader];

        if (account.borrowed[tokenTo] > 0) {
            extinguishableDebt = min(outAmount, account.borrowed[tokenTo]);
            extinguishDebt(account, tokenTo, extinguishableDebt);
            totalShort[tokenTo] -= extinguishableDebt;
        }
        totalLong[tokenFrom] -= inAmount;
        totalLong[tokenTo] += outAmount - extinguishableDebt;
        require(
            tokenCaps[tokenTo] >= totalLong[tokenTo],
            "Exceeding global exposure cap to token -- try again later"
        );

        uint256 sellAmount = inAmount;
        if (inAmount > account.holdings[tokenFrom]) {
            sellAmount = account.holdings[tokenFrom];
            /// won't overflow
            borrowAmount = inAmount - sellAmount;

            totalShort[tokenFrom] += borrowAmount;
            require(
                tokenCaps[tokenFrom] >= totalShort[tokenFrom],
                "Exceeding global exposure cap to token -- try again later"
            );

            borrow(account, tokenFrom, borrowAmount);
        }
        adjustAmounts(account, tokenFrom, tokenTo, sellAmount, outAmount);
    }

    /// @dev can get called by router to register the dissolution of an account
    function registerLiquidation(address trader) external override {
        require(
            isMarginTrader(msg.sender),
            "Calling contract is not an authorized margin trader agent"
        );
        CrossMarginAccount storage account = marginAccounts[trader];
        require(
            loanInPeg(account, false) == 0,
            "Can't liquidate currently borrowing account"
        );

        deleteAccount(account);
    }

    /// @dev view function to display account held assets state
    function getHoldingAmounts(address trader)
        external
        view
        override
        returns (
            address[] memory holdingTokens,
            uint256[] memory holdingAmounts
        )
    {
        CrossMarginAccount storage account = marginAccounts[trader];
        holdingTokens = account.holdingTokens;

        holdingAmounts = new uint256[](account.holdingTokens.length);
        for (uint256 idx = 0; holdingTokens.length > idx; idx++) {
            address tokenAddress = holdingTokens[idx];
            holdingAmounts[idx] = account.holdings[tokenAddress];
        }
    }

    /// @dev view function to display account borrowing state
    function getBorrowAmounts(address trader)
        external
        view
        override
        returns (address[] memory borrowTokens, uint256[] memory borrowAmounts)
    {
        CrossMarginAccount storage account = marginAccounts[trader];
        borrowTokens = account.borrowTokens;

        borrowAmounts = new uint256[](account.borrowTokens.length);
        for (uint256 idx = 0; borrowTokens.length > idx; idx++) {
            address tokenAddress = borrowTokens[idx];
            borrowAmounts[idx] = Lending(lending()).viewBorrowInterest(
                account.borrowed[tokenAddress],
                tokenAddress,
                account.borrowedYieldQuotientsFP[tokenAddress]
            );
        }
    }

    /// @dev view function to get loan amount in peg
    function viewLoanInPeg(address trader)
        external
        view
        returns (uint256 amount)
    {
        CrossMarginAccount storage account = marginAccounts[trader];
        return
            viewTokensInPegWithYield(
                account.borrowTokens,
                account.borrowed,
                account.borrowedYieldQuotientsFP
            );
    }

    /// @dev total of assets of account, expressed in reference currency
    function viewHoldingsInPeg(address trader) external view returns (uint256) {
        CrossMarginAccount storage account = marginAccounts[trader];
        return viewTokensInPeg(account.holdingTokens, account.holdings);
    }
}
