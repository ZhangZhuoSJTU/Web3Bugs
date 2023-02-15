// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

import "../global/Types.sol";
import "../global/Constants.sol";
import "../global/LibStorage.sol";
import "../math/SafeInt256.sol";
import "../math/FloatingPoint56.sol";

library BalanceHandler {
    using SafeInt256 for int256;

    /// @notice Emitted when reserve balance is updated
    event ReserveBalanceUpdated(uint16 indexed currencyId, int256 newBalance);
    /// @notice Emitted when reserve balance is harvested
    event ExcessReserveBalanceHarvested(uint16 indexed currencyId, int256 harvestAmount);

    /// @notice harvests excess reserve balance
    function harvestExcessReserveBalance(uint16 currencyId, int256 reserve, int256 assetInternalRedeemAmount) internal {
        // parameters are validated by the caller
        reserve = reserve.subNoNeg(assetInternalRedeemAmount);
        _setBalanceStorage(Constants.RESERVE, currencyId, reserve, 0, 0, 0);
        emit ExcessReserveBalanceHarvested(currencyId, assetInternalRedeemAmount);
    }

    /// @notice sets the reserve balance, see TreasuryAction.setReserveCashBalance
    function setReserveCashBalance(uint16 currencyId, int256 newBalance) internal {
        require(newBalance >= 0); // dev: invalid balance
        _setBalanceStorage(Constants.RESERVE, currencyId, newBalance, 0, 0, 0);
        emit ReserveBalanceUpdated(currencyId, newBalance);
    }

    /// @notice Sets internal balance storage.
    function _setBalanceStorage(
        address account,
        uint256 currencyId,
        int256 cashBalance,
        int256 nTokenBalance,
        uint256 lastClaimTime,
        uint256 lastClaimIntegralSupply
    ) private {
        mapping(address => mapping(uint256 => BalanceStorage)) storage store = LibStorage.getBalanceStorage();
        BalanceStorage storage balanceStorage = store[account][currencyId];

        require(cashBalance >= type(int88).min && cashBalance <= type(int88).max); // dev: stored cash balance overflow
        // Allows for 12 quadrillion nToken balance in 1e8 decimals before overflow
        require(nTokenBalance >= 0 && nTokenBalance <= type(uint80).max); // dev: stored nToken balance overflow
        require(lastClaimTime <= type(uint32).max); // dev: last claim time overflow

        balanceStorage.nTokenBalance = uint80(nTokenBalance);
        balanceStorage.lastClaimTime = uint32(lastClaimTime);
        balanceStorage.cashBalance = int88(cashBalance);

        // Last claim supply is stored in a "floating point" storage slot that does not maintain exact precision but
        // is also not limited by storage overflows. `packTo56Bits` will ensure that the the returned value will fit
        // in 56 bits (7 bytes)
        balanceStorage.packedLastClaimIntegralSupply = FloatingPoint56.packTo56Bits(lastClaimIntegralSupply);
    }

    /// @notice Gets internal balance storage, nTokens are stored alongside cash balances
    function getBalanceStorage(address account, uint256 currencyId)
        internal
        view
        returns (
            int256 cashBalance,
            int256 nTokenBalance,
            uint256 lastClaimTime,
            uint256 lastClaimIntegralSupply
        )
    {
        mapping(address => mapping(uint256 => BalanceStorage)) storage store = LibStorage.getBalanceStorage();
        BalanceStorage storage balanceStorage = store[account][currencyId];

        nTokenBalance = balanceStorage.nTokenBalance;
        lastClaimTime = balanceStorage.lastClaimTime;
        lastClaimIntegralSupply = FloatingPoint56.unpackFrom56Bits(balanceStorage.packedLastClaimIntegralSupply);
        cashBalance = balanceStorage.cashBalance;
    }

}
