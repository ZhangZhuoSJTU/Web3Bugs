// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./Incentives.sol";
import "./TokenHandler.sol";
import "../AccountContextHandler.sol";
import "../../global/Types.sol";
import "../../global/Constants.sol";
import "../../math/SafeInt256.sol";
import "../../math/FloatingPoint56.sol";

library BalanceHandler {
    using SafeInt256 for int256;
    using TokenHandler for Token;
    using AssetRate for AssetRateParameters;
    using AccountContextHandler for AccountContext;

    /// @notice Emitted when a cash balance changes
    event CashBalanceChange(address indexed account, uint16 currencyId, int256 netCashChange);
    /// @notice Emitted when nToken supply changes (not the same as transfers)
    event nTokenSupplyChange(address indexed account, uint16 currencyId, int256 tokenSupplyChange);

    /// @notice Deposits asset tokens into an account
    /// @dev Handles two special cases when depositing tokens into an account.
    ///  - If a token has transfer fees then the amount specified does not equal the amount that the contract
    ///    will receive. Complete the deposit here rather than in finalize so that the contract has the correct
    ///    balance to work with.
    ///  - Force a transfer before finalize to allow a different account to deposit into an account
    /// @return Returns two values:
    ///  - assetAmountInternal which is the converted asset amount accounting for transfer fees
    ///  - assetAmountTransferred which is the internal precision amount transferred into the account
    function depositAssetToken(
        BalanceState memory balanceState,
        address account,
        int256 assetAmountExternal,
        bool forceTransfer
    ) internal returns (int256) {
        if (assetAmountExternal == 0) return 0;
        require(assetAmountExternal > 0); // dev: deposit asset token amount negative
        Token memory token = TokenHandler.getToken(balanceState.currencyId, false);
        int256 assetAmountInternal = token.convertToInternal(assetAmountExternal);

        // Force transfer is used to complete the transfer before going to finalize
        if (token.hasTransferFee || forceTransfer) {
            // If the token has a transfer fee the deposit amount may not equal the actual amount
            // that the contract will receive. We handle the deposit here and then update the netCashChange
            // accordingly which is denominated in internal precision.
            int256 assetAmountExternalPrecisionFinal = token.transfer(account, assetAmountExternal);
            // Convert the external precision to internal, it's possible that we lose dust amounts here but
            // this is unavoidable because we do not know how transfer fees are calculated.
            assetAmountInternal = token.convertToInternal(assetAmountExternalPrecisionFinal);
            balanceState.netCashChange = balanceState.netCashChange.add(assetAmountInternal);

            return assetAmountInternal;
        }

        // Otherwise add the asset amount here. It may be net off later and we want to only do
        // a single transfer during the finalize method. Use internal precision to ensure that internal accounting
        // and external account remain in sync.
        balanceState.netAssetTransferInternalPrecision = balanceState
            .netAssetTransferInternalPrecision
            .add(assetAmountInternal);

        // Returns the converted assetAmountExternal to the internal amount
        return assetAmountInternal;
    }

    /// @notice Handle deposits of the underlying token
    /// @dev In this case we must wrap the underlying token into an asset token, ensuring that we do not end up
    /// with any underlying tokens left as dust on the contract.
    function depositUnderlyingToken(
        BalanceState memory balanceState,
        address account,
        int256 underlyingAmountExternal
    ) internal returns (int256) {
        if (underlyingAmountExternal == 0) return 0;
        require(underlyingAmountExternal > 0); // dev: deposit underlying token negative

        Token memory underlyingToken = TokenHandler.getToken(balanceState.currencyId, true);
        // This is the exact amount of underlying tokens the account has in external precision.
        if (underlyingToken.tokenType == TokenType.Ether) {
            require(underlyingAmountExternal == int256(msg.value), "Invalid ETH balance");
        } else {
            underlyingAmountExternal = underlyingToken.transfer(account, underlyingAmountExternal);
        }

        Token memory assetToken = TokenHandler.getToken(balanceState.currencyId, false);
        // Tokens that are not mintable like cTokens will be deposited as assetTokens
        require(assetToken.tokenType == TokenType.cToken || assetToken.tokenType == TokenType.cETH); // dev: deposit underlying token invalid token type
        int256 assetTokensReceivedExternalPrecision =
            assetToken.mint(uint256(underlyingAmountExternal));

        // cTokens match INTERNAL_TOKEN_PRECISION so this will short circuit but we leave this here in case a different
        // type of asset token is listed in the future. It's possible if those tokens have a different precision dust may
        // accrue but that is not relevant now.
        int256 assetTokensReceivedInternal =
            assetToken.convertToInternal(assetTokensReceivedExternalPrecision);
        balanceState.netCashChange = balanceState.netCashChange.add(assetTokensReceivedInternal);

        return assetTokensReceivedInternal;
    }

    /// @notice Finalizes an account's balances, handling any transfer logic required
    /// @dev This method SHOULD NOT be used for nToken accounts, for that use setBalanceStorageForNToken
    /// as the nToken is limited in what types of balances it can hold.
    function finalize(
        BalanceState memory balanceState,
        address account,
        AccountContext memory accountContext,
        bool redeemToUnderlying
    ) internal returns (int256 transferAmountExternal) {
        bool mustUpdate;
        if (balanceState.netNTokenTransfer < 0) {
            require(
                balanceState.storedNTokenBalance.add(balanceState.netNTokenSupplyChange) >=
                    balanceState.netNTokenTransfer.neg(),
                "Neg withdraw"
            );
        }

        if (balanceState.netAssetTransferInternalPrecision < 0) {
            require(
                balanceState.storedCashBalance.add(balanceState.netCashChange).add(
                    balanceState.netAssetTransferInternalPrecision
                ) >= 0,
                "Neg withdraw"
            );
        }

        if (balanceState.netAssetTransferInternalPrecision != 0) {
            transferAmountExternal = _finalizeTransfers(balanceState, account, redeemToUnderlying);
        }

        if (
            balanceState.netCashChange != 0 || balanceState.netAssetTransferInternalPrecision != 0
        ) {
            balanceState.storedCashBalance = balanceState
                .storedCashBalance
                .add(balanceState.netCashChange)
                .add(balanceState.netAssetTransferInternalPrecision);

            mustUpdate = true;

            emit CashBalanceChange(
                account,
                uint16(balanceState.currencyId),
                balanceState.netCashChange.add(balanceState.netAssetTransferInternalPrecision)
            );
        }

        if (balanceState.netNTokenTransfer != 0 || balanceState.netNTokenSupplyChange != 0) {
            // It's crucial that incentives are claimed before we do any sort of nToken transfer to prevent gaming
            // of the system. This method will update the lastClaimTime time in the balanceState for storage.
            Incentives.claimIncentives(balanceState, account);

            // nTokens are within the notional system so we can update balances directly.
            balanceState.storedNTokenBalance = balanceState
                .storedNTokenBalance
                .add(balanceState.netNTokenTransfer)
                .add(balanceState.netNTokenSupplyChange);

            if (balanceState.netNTokenSupplyChange != 0) {
                emit nTokenSupplyChange(
                    account,
                    uint16(balanceState.currencyId),
                    balanceState.netNTokenSupplyChange
                );
            }

            mustUpdate = true;
        }

        if (mustUpdate) {
            _setBalanceStorage(
                account,
                balanceState.currencyId,
                balanceState.storedCashBalance,
                balanceState.storedNTokenBalance,
                balanceState.lastClaimTime,
                balanceState.lastClaimIntegralSupply
            );
        }

        accountContext.setActiveCurrency(
            balanceState.currencyId,
            // Set active currency to true if either balance is non-zero
            balanceState.storedCashBalance != 0 || balanceState.storedNTokenBalance != 0,
            Constants.ACTIVE_IN_BALANCES
        );

        if (balanceState.storedCashBalance < 0) {
            // NOTE: HAS_CASH_DEBT cannot be extinguished except by a free collateral check where all balances
            // are examined
            accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_CASH_DEBT;
        }

        return transferAmountExternal;
    }

    /// @dev Returns the amount transferred in underlying or asset terms depending on how redeem to underlying
    /// is specified.
    function _finalizeTransfers(
        BalanceState memory balanceState,
        address account,
        bool redeemToUnderlying
    ) private returns (int256 actualTransferAmountExternal) {
        Token memory assetToken = TokenHandler.getToken(balanceState.currencyId, false);
        int256 assetTransferAmountExternal =
            assetToken.convertToExternal(balanceState.netAssetTransferInternalPrecision);

        // We only do the redeem to underlying if the asset transfer amount is less than zero. If it is greater than
        // zero then we will do a normal transfer instead. We know in this function that the value will not be zero.
        if (redeemToUnderlying && assetTransferAmountExternal < 0) {
            // We use the internal amount here and then scale it to the external amount so that there is
            // no loss of precision between our internal accounting and the external account. In this case
            // there will be no dust accrual since we will transfer the exact amount of underlying that was
            // received.
            Token memory underlyingToken = TokenHandler.getToken(balanceState.currencyId, true);
            int256 underlyingAmountExternal = assetToken.redeem(
                underlyingToken,
                // NOTE: dust may accrue at the lowest decimal place
                uint256(assetTransferAmountExternal.neg())
            );

            // Withdraws the underlying amount out to the destination account
            actualTransferAmountExternal = underlyingToken.transfer(
                account,
                underlyingAmountExternal.neg()
            );
        } else {
            assetTransferAmountExternal = assetToken.transfer(account, assetTransferAmountExternal);
            actualTransferAmountExternal = assetTransferAmountExternal;
        }

        // Convert the actual transferred amount
        balanceState.netAssetTransferInternalPrecision = assetToken.convertToInternal(
            assetTransferAmountExternal
        );

        return actualTransferAmountExternal;
    }

    /// @notice Special method for settling negative current cash debts. This occurs when an account
    /// has a negative fCash balance settle to cash. A settler may come and force the account to borrow
    /// at the prevailing 3 month rate
    /// @dev Use this method to avoid any nToken and transfer logic in finalize which is unnecessary.
    function setBalanceStorageForSettleCashDebt(
        address account,
        CashGroupParameters memory cashGroup,
        int256 amountToSettleAsset,
        AccountContext memory accountContext
    ) internal returns (int256) {
        require(amountToSettleAsset >= 0); // dev: amount to settle negative
        (int256 cashBalance, int256 nTokenBalance, uint256 lastClaimTime, uint256 lastClaimIntegralSupply) =
            getBalanceStorage(account, cashGroup.currencyId);

        require(cashBalance < 0, "Invalid settle balance");
        if (amountToSettleAsset == 0) {
            // Symbolizes that the entire debt should be settled
            amountToSettleAsset = cashBalance.neg();
            cashBalance = 0;
        } else {
            // A partial settlement of the debt
            require(amountToSettleAsset <= cashBalance.neg(), "Invalid amount to settle");
            cashBalance = cashBalance.add(amountToSettleAsset);
        }

        // NOTE: we do not update HAS_CASH_DEBT here because it is possible that the other balances
        // also have cash debts
        if (cashBalance == 0 && nTokenBalance == 0) {
            accountContext.setActiveCurrency(
                cashGroup.currencyId,
                false,
                Constants.ACTIVE_IN_BALANCES
            );
        }

        _setBalanceStorage(
            account,
            cashGroup.currencyId,
            cashBalance,
            nTokenBalance,
            lastClaimTime,
            lastClaimIntegralSupply
        );

        // Emit the event here, we do not call finalize
        emit CashBalanceChange(account, uint16(cashGroup.currencyId), amountToSettleAsset);

        return amountToSettleAsset;
    }

    /// @notice Helper method for settling the output of the SettleAssets method
    function finalizeSettleAmounts(
        address account,
        AccountContext memory accountContext,
        SettleAmount[] memory settleAmounts
    ) internal {
        for (uint256 i; i < settleAmounts.length; i++) {
            if (settleAmounts[i].netCashChange == 0) continue;

            (
                int256 cashBalance,
                int256 nTokenBalance,
                uint256 lastClaimTime,
                uint256 lastClaimIntegralSupply
            ) = getBalanceStorage(account, settleAmounts[i].currencyId);

            cashBalance = cashBalance.add(settleAmounts[i].netCashChange);
            accountContext.setActiveCurrency(
                settleAmounts[i].currencyId,
                cashBalance != 0 || nTokenBalance != 0,
                Constants.ACTIVE_IN_BALANCES
            );

            if (cashBalance < 0) {
                accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_CASH_DEBT;
            }

            emit CashBalanceChange(
                account,
                uint16(settleAmounts[i].currencyId),
                settleAmounts[i].netCashChange
            );

            _setBalanceStorage(
                account,
                settleAmounts[i].currencyId,
                cashBalance,
                nTokenBalance,
                lastClaimTime,
                lastClaimIntegralSupply
            );
        }
    }

    /// @notice Special method for setting balance storage for nToken
    function setBalanceStorageForNToken(
        address nTokenAddress,
        uint256 currencyId,
        int256 cashBalance
    ) internal {
        require(cashBalance >= 0); // dev: invalid nToken cash balance
        _setBalanceStorage(nTokenAddress, currencyId, cashBalance, 0, 0, 0);
    }

    /// @notice increments fees to the reserve
    function incrementFeeToReserve(uint256 currencyId, int256 fee) internal {
        require(fee >= 0); // dev: invalid fee
        // prettier-ignore
        (int256 totalReserve, /* */, /* */, /* */) = getBalanceStorage(Constants.RESERVE, currencyId);
        totalReserve = totalReserve.add(fee);
        _setBalanceStorage(Constants.RESERVE, currencyId, totalReserve, 0, 0, 0);
    }

    function _getSlot(address account, uint256 currencyId) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    currencyId,
                    keccak256(abi.encode(account, Constants.BALANCE_STORAGE_OFFSET))
                )
            );
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
        bytes32 slot = _getSlot(account, currencyId);
        require(cashBalance >= type(int88).min && cashBalance <= type(int88).max); // dev: stored cash balance overflow
        // Allows for 12 quadrillion nToken balance in 1e8 decimals before overflow
        require(nTokenBalance >= 0 && nTokenBalance <= type(uint80).max); // dev: stored nToken balance overflow
        require(lastClaimTime >= 0 && lastClaimTime <= type(uint32).max); // dev: last claim time overflow
        // Last claim supply is stored in a "floating point" storage slot that does not maintain exact precision but
        // is also not limited by storage overflows. `packTo56Bits` will ensure that the the returned value will fit
        // in 56 bits (7 bytes)
        bytes32 packedLastClaimIntegralSupply = FloatingPoint56.packTo56Bits(lastClaimIntegralSupply);

        bytes32 data =
            ((bytes32(uint256(nTokenBalance))) |
                (bytes32(lastClaimTime) << 80) |
                (packedLastClaimIntegralSupply << 112) |
                (bytes32(cashBalance) << 168));

        assembly {
            sstore(slot, data)
        }
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
        bytes32 slot = _getSlot(account, currencyId);
        bytes32 data;

        assembly {
            data := sload(slot)
        }

        nTokenBalance = int256(uint80(uint256(data)));
        lastClaimTime = uint256(uint32(uint256(data >> 80)));
        lastClaimIntegralSupply = FloatingPoint56.unpackFrom56Bits(uint256(uint56(uint256(data >> 112))));
        cashBalance = int256(int88(int256(data >> 168)));
    }

    /// @notice Loads a balance state memory object
    /// @dev Balance state objects occupy a lot of memory slots, so this method allows
    /// us to reuse them if possible
    function loadBalanceState(
        BalanceState memory balanceState,
        address account,
        uint256 currencyId,
        AccountContext memory accountContext
    ) internal view {
        require(currencyId != 0); // dev: invalid currency id
        balanceState.currencyId = currencyId;

        if (accountContext.isActiveInBalances(currencyId)) {
            (
                balanceState.storedCashBalance,
                balanceState.storedNTokenBalance,
                balanceState.lastClaimTime,
                balanceState.lastClaimIntegralSupply
            ) = getBalanceStorage(account, currencyId);
        } else {
            balanceState.storedCashBalance = 0;
            balanceState.storedNTokenBalance = 0;
            balanceState.lastClaimTime = 0;
            balanceState.lastClaimIntegralSupply = 0;
        }

        balanceState.netCashChange = 0;
        balanceState.netAssetTransferInternalPrecision = 0;
        balanceState.netNTokenTransfer = 0;
        balanceState.netNTokenSupplyChange = 0;
    }

    /// @notice Used when manually claiming incentives in nTokenAction
    function claimIncentivesManual(BalanceState memory balanceState, address account)
        internal
        returns (uint256)
    {
        uint256 incentivesClaimed = Incentives.claimIncentives(balanceState, account);
        _setBalanceStorage(
            account,
            balanceState.currencyId,
            balanceState.storedCashBalance,
            balanceState.storedNTokenBalance,
            balanceState.lastClaimTime,
            balanceState.lastClaimIntegralSupply
        );

        return incentivesClaimed;
    }
}
