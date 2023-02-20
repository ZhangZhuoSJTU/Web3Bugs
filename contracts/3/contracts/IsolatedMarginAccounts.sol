// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RoleAware.sol";
import "./Lending.sol";
import "./PriceAware.sol";

abstract contract IsolatedMarginAccounts is RoleAware {
    struct IsolatedMarginAccount {
        uint256 lastDepositBlock;
        uint256 borrowed;
        uint256 borrowedYieldQuotientFP;
        uint256 holding;
    }

    address public borrowToken;
    address public holdingToken;

    uint256 public totalDebt;

    address[] public liquidationPairs;
    address[] public liquidationTokens;

    /// update window in blocks
    uint16 public priceUpdateWindow = 8;
    uint256 public UPDATE_RATE_PERMIL = 80;

    /// @dev percentage of assets held per assets borrowed at which to liquidate
    uint256 public liquidationThresholdPercent;

    mapping(address => IsolatedMarginAccount) public marginAccounts;
    uint256 public coolingOffPeriod = 20;
    uint256 public leveragePercent = 500;

    /// @dev adjust account to reflect borrowing of token amount
    function borrow(IsolatedMarginAccount storage account, uint256 amount)
        internal
    {
        updateLoan(account);
        account.borrowed += amount;
        require(positiveBalance(account), "Can't borrow: insufficient balance");
    }

    function updateLoan(IsolatedMarginAccount storage account) internal {
        account.borrowed = Lending(lending()).applyBorrowInterest(
            account.borrowed,
            address(this),
            account.borrowedYieldQuotientFP
        );
        account.borrowedYieldQuotientFP = Lending(lending())
            .viewBorrowingYieldFP(address(this));
    }

    /// @dev checks whether account is in the black, deposit + earnings relative to borrowed
    function positiveBalance(IsolatedMarginAccount storage account)
        internal
        returns (bool)
    {
        uint256 loan = loanInPeg(account, false);
        uint256 holdings = holdingInPeg(account, false);

        // The following condition should hold:
        // holdings / loan >= leveragePercent / (leveragePercent - 100)
        // =>
        return holdings * (leveragePercent - 100) >= loan * leveragePercent;
    }

    /// @dev internal function adjusting holding and borrow balances when debt extinguished
    function extinguishDebt(
        IsolatedMarginAccount storage account,
        uint256 extinguishAmount
    ) internal {
        // TODO check if underflow?
        // TODO TELL LENDING
        updateLoan(account);
        account.borrowed -= extinguishAmount;
    }

    /// @dev check whether an account can/should be liquidated
    function belowMaintenanceThreshold(IsolatedMarginAccount storage account)
        internal
        returns (bool)
    {
        uint256 loan = loanInPeg(account, true);
        uint256 holdings = holdingInPeg(account, true);
        // The following should hold:
        // holdings / loan >= 1.1
        // => holdings >= loan * 1.1
        return 100 * holdings >= liquidationThresholdPercent * loan;
    }

    /// @dev calculate loan in reference currency
    function loanInPeg(
        IsolatedMarginAccount storage account,
        bool forceCurBlock
    ) internal returns (uint256) {
        return
            PriceAware(price()).getCurrentPriceInPeg(
                borrowToken,
                account.borrowed,
                forceCurBlock
            );
    }

    /// @dev calculate loan in reference currency
    function holdingInPeg(
        IsolatedMarginAccount storage account,
        bool forceCurBlock
    ) internal returns (uint256) {
        return
            PriceAware(price()).getCurrentPriceInPeg(
                holdingToken,
                account.holding,
                forceCurBlock
            );
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
