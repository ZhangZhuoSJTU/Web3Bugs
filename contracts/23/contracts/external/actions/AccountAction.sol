// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../SettleAssetsExternal.sol";
import "../FreeCollateralExternal.sol";
import "../../math/SafeInt256.sol";
import "../../internal/balances/BalanceHandler.sol";
import "../../internal/AccountContextHandler.sol";

contract AccountAction {
    using BalanceHandler for BalanceState;
    using AccountContextHandler for AccountContext;
    using SafeInt256 for int256;

    /// @notice Enables a bitmap currency for msg.sender, account cannot have any assets when this call
    /// occurs.
    /// @param currencyId the currency to enable the bitmap for
    /// @dev emit:AccountSettled emit:AccountContextUpdate
    /// @dev auth:msg.sender
    function enableBitmapCurrency(uint16 currencyId) external {
        require(msg.sender != address(this)); // dev: no internal call to enableBitmapCurrency
        address account = msg.sender;
        AccountContext memory accountContext = _settleAccountIfRequiredAndFinalize(account);
        accountContext.enableBitmapForAccount(account, currencyId, block.timestamp);
        accountContext.setAccountContext(account);
    }

    /// @notice Method for manually settling an account, generally should not be called because other
    /// methods will check if an account needs to be settled automatically. If a bitmap account has debt
    /// and is settled via this method, the hasDebt flag will not be cleared until a free collateral check
    /// is performed on the account.
    /// @param account the account to settle
    /// @dev emit:AccountSettled emit:AccountContextUpdate
    /// @dev auth:none
    function settleAccount(address account) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        if (accountContext.mustSettleAssets()) {
            accountContext = SettleAssetsExternal.settleAssetsAndFinalize(account, accountContext);
            // Don't use the internal method here to avoid setting the account context if it does
            // not require settlement
            accountContext.setAccountContext(account);
        }
    }

    /// @notice Deposits and wraps the underlying token for a particular cToken. Does not settle assets or check free
    /// collateral, idea is to be as gas efficient as possible during potential liquidation events.
    /// @param account the account to deposit into
    /// @param currencyId currency id of the asset token that wraps this underlying
    /// @param amountExternalPrecision the amount of underlying tokens in its native decimal precision
    /// (i.e. 18 decimals for DAI or 6 decimals for USDC). This will be converted to 8 decimals during transfer.
    /// @return asset tokens minted and deposited to the account in internal decimals (8)
    /// @dev emit:CashBalanceChange emit:AccountContextUpdate
    /// @dev auth:none
    function depositUnderlyingToken(
        address account,
        uint16 currencyId,
        uint256 amountExternalPrecision
    ) external payable returns (uint256) {
        // No other authorization required on depositing
        require(msg.sender != address(this)); // dev: no internal call to deposit underlying

        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        BalanceState memory balanceState;
        balanceState.loadBalanceState(account, currencyId, accountContext);

        // Int conversion overflow check done inside this method call
        // NOTE: using msg.sender here allows for a different sender to deposit tokens into the specified account. This may
        // be useful for on-demand collateral top ups from a third party
        int256 assetTokensReceivedInternal = balanceState.depositUnderlyingToken(
            msg.sender,
            int256(amountExternalPrecision)
        );

        balanceState.finalize(account, accountContext, false);
        accountContext.setAccountContext(account);

        require(assetTokensReceivedInternal > 0); // dev: asset tokens negative

        // NOTE: no free collateral checks required for depositing
        return uint256(assetTokensReceivedInternal);
    }

    /// @notice Deposits asset tokens into an account. Does not settle or check free collateral, idea is to
    /// make deposit as gas efficient as possible during potential liquidation events.
    /// @param account the account to deposit into
    /// @param currencyId currency id of the asset token
    /// @param amountExternalPrecision the amount of asset tokens in its native decimal precision
    /// (i.e. 8 decimals for cTokens). This will be converted to 8 decimals during transfer if necessary.
    /// @return asset tokens minted and deposited to the account in internal decimals (8)
    /// @dev emit:CashBalanceChange emit:AccountContextUpdate
    /// @dev auth:none
    function depositAssetToken(
        address account,
        uint16 currencyId,
        uint256 amountExternalPrecision
    ) external returns (uint256) {
        require(msg.sender != address(this)); // dev: no internal call to deposit asset

        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        BalanceState memory balanceState;
        balanceState.loadBalanceState(account, currencyId, accountContext);

        // Int conversion overflow check done inside this method call. msg.sender
        // is used as the account in deposit to allow for other accounts to deposit
        // on behalf of the given account.
        int256 assetTokensReceivedInternal = balanceState.depositAssetToken(
            msg.sender,
            int256(amountExternalPrecision),
            true // force transfer to ensure that msg.sender does the transfer, not account
        );

        balanceState.finalize(account, accountContext, false);
        accountContext.setAccountContext(account);

        require(assetTokensReceivedInternal > 0); // dev: asset tokens negative

        // NOTE: no free collateral checks required for depositing
        return uint256(assetTokensReceivedInternal);
    }

    /// @notice Withdraws balances from Notional, may also redeem to underlying tokens on user request. Will settle
    /// and do free collateral checks if required. Can only be called by msg.sender, operators who want to withdraw for
    /// an account must do an authenticated call via ERC1155Action `safeTransferFrom` or `safeBatchTransferFrom`
    /// @param currencyId currency id of the asset token
    /// @param amountInternalPrecision the amount of asset tokens in its native decimal precision
    /// (i.e. 8 decimals for cTokens). This will be converted to 8 decimals during transfer if necessary.
    /// @param redeemToUnderlying true if the tokens should be converted to underlying assets
    /// @dev emit:CashBalanceChange emit:AccountContextUpdate
    /// @dev auth:msg.sender
    /// @return the amount of tokens received by the account denominated in the destination token precision (if
    // redeeming to underlying the amount will be the underlying amount received in that token's native precision)
    function withdraw(
        uint16 currencyId,
        uint88 amountInternalPrecision,
        bool redeemToUnderlying
    ) external returns (uint256) {
        address account = msg.sender;

        // This happens before reading the balance state to get the most up to date cash balance
        AccountContext memory accountContext = _settleAccountIfRequiredAndFinalize(account);

        BalanceState memory balanceState;
        balanceState.loadBalanceState(account, currencyId, accountContext);
        require(balanceState.storedCashBalance >= amountInternalPrecision, "Insufficient balance");
        balanceState.netAssetTransferInternalPrecision = int256(amountInternalPrecision).neg();

        int256 amountWithdrawn = balanceState.finalize(account, accountContext, redeemToUnderlying);

        accountContext.setAccountContext(account);
        if (accountContext.hasDebt != 0x00) {
            FreeCollateralExternal.checkFreeCollateralAndRevert(account);
        }

        require(amountWithdrawn <= 0);
        return uint256(amountWithdrawn.neg());
    }

    function _settleAccountIfRequiredAndFinalize(address account)
        private
        returns (AccountContext memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        if (accountContext.mustSettleAssets()) {
            return SettleAssetsExternal.settleAssetsAndFinalize(account, accountContext);
        }

        return accountContext;
    }
}
