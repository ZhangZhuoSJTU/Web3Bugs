// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../../utils/types/UFixed18.sol";

/// @dev OptimisticLedger type
struct OptimisticLedger {
    /// @dev Individual account collateral balances
    mapping(address => UFixed18) balances;

    /// @dev Total ledger collateral balance
    UFixed18 total;

    /// @dev Total ledger collateral shortfall
    UFixed18 shortfall;
}

/**
 * @title OptimisticLedgerLib
 * @notice Library that manages a global vs account ledger where the global ledger is settled separately,
 *         and ahead of, the user-level accounts.
 * @dev    Ensures that no more collateral leaves the ledger than goes it, while allowing user-level accounts
 *         to settle as a follow up step. Overdrafts on the user-level are accounted as "shortall". Shortfall
 *         in the system is the quantity of insolvency that can be optionally resolved by the ledger owner.
 *         Until the shortfall is resolved, collateral may be withdrawn from the ledger on a FCFS basis. However
 *         once the ledger total has been depleted, users will not be able to withdraw even if they have non-zero
 *         user level balances until the shortfall is resolved, recapitalizing the ledger.
 */
library OptimisticLedgerLib {
    using UFixed18Lib for UFixed18;
    using Fixed18Lib for Fixed18;

    /**
     * @notice Credits `account` with `amount` collateral
     * @param self The struct to operate on
     * @param account Account to credit collateral to
     * @param amount Amount of collateral to credit
     */
    function creditAccount(OptimisticLedger storage self, address account, UFixed18 amount) internal {
        self.balances[account] = self.balances[account].add(amount);
        self.total = self.total.add(amount);
    }

    /**
     * @notice Debits `account` `amount` collateral
     * @param self The struct to operate on
     * @param account Account to debit collateral from
     * @param amount Amount of collateral to debit
     */
    function debitAccount(OptimisticLedger storage self, address account, UFixed18 amount) internal {
        self.balances[account] = self.balances[account].sub(amount);
        self.total = self.total.sub(amount);
    }

    /**
     * @notice Credits `account` with `amount` collateral
     * @dev Funds come from inside the product, not totals are updated
     *      Shortfall is created if more funds are debited from an account than exist
     * @param self The struct to operate on
     * @param account Account to credit collateral to
     * @param amount Amount of collateral to credit
     */
    function settleAccount(OptimisticLedger storage self, address account, Fixed18 amount)
    internal returns (UFixed18 shortfall) {
        Fixed18 newBalance = Fixed18Lib.from(self.balances[account]).add(amount);

        if (newBalance.sign() == -1) {
            shortfall = self.shortfall.add(newBalance.abs());
            newBalance = Fixed18Lib.ZERO;
        }

        self.balances[account] = newBalance.abs();
        self.shortfall = self.shortfall.add(shortfall);
    }

    /**
     * @notice Debits ledger globally `amount` collateral
     * @dev Removes balance from total that is accounted for elsewhere (e.g. product-level accumulators)
     * @param self The struct to operate on
     * @param amount Amount of collateral to debit
     */
    function debit(OptimisticLedger storage self, UFixed18 amount) internal {
        self.total = self.total.sub(amount);
    }

    /**
     * @notice Reduces the amount of collateral shortfall in the ledger
     * @param self The struct to operate on
     * @param amount Amount of shortfall to resolve
     */
    function resolve(OptimisticLedger storage self, UFixed18 amount) internal {
        self.shortfall = self.shortfall.sub(amount);
        self.total = self.total.add(amount);
    }
}
