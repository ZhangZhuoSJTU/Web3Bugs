// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../../internal/nTokenHandler.sol";
import "../../internal/markets/AssetRate.sol";
import "../../internal/balances/BalanceHandler.sol";
import "../../internal/balances/Incentives.sol";
import "../../math/SafeInt256.sol";
import "../../global/StorageLayoutV1.sol";
import "interfaces/notional/nTokenERC20.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract nTokenAction is StorageLayoutV1, nTokenERC20 {
    using BalanceHandler for BalanceState;
    using AssetRate for AssetRateParameters;
    using AccountContextHandler for AccountContext;
    using SafeInt256 for int256;
    using SafeMath for uint256;

    /// @notice Total number of tokens in circulation
    /// @param nTokenAddress The address of the nToken
    /// @return totalSupply number of tokens held
    function nTokenTotalSupply(address nTokenAddress)
        external
        view
        override
        returns (uint256 totalSupply)
    {
        // prettier-ignore
        (
            totalSupply,
            /* integralTotalSupply */,
            /* lastSupplyChangeTime */
        ) = nTokenHandler.getStoredNTokenSupplyFactors(nTokenAddress);
    }

    /// @notice Get the number of tokens held by the `account`
    /// @param account The address of the account to get the balance of
    /// @return The number of tokens held
    function nTokenBalanceOf(uint16 currencyId, address account)
        external
        view
        override
        returns (uint256)
    {
        // prettier-ignore
        (
            /* int cashBalance */,
            int256 nTokenBalance,
            /* uint lastClaimTime */,
            /* uint lastClaimIntegralSupply */
        ) = BalanceHandler.getBalanceStorage(account, currencyId);

        require(nTokenBalance >= 0); // dev: negative nToken balance
        return uint256(nTokenBalance);
    }

    /// @notice Get the number of tokens `spender` is approved to spend on behalf of `account`
    /// @param owner The address of the account holding the funds
    /// @param spender The address of the account spending the funds
    /// @return The number of tokens approved
    function nTokenTransferAllowance(
        uint16 currencyId,
        address owner,
        address spender
    ) external view override returns (uint256) {
        // This whitelist allowance supersedes any specific allowances
        uint256 allowance = nTokenWhitelist[owner][spender];
        if (allowance > 0) return allowance;

        return nTokenAllowance[owner][spender][currencyId];
    }

    /// @notice Approve `spender` to transfer up to `amount` from `src`
    /// @dev Can only be called via the nToken proxy
    /// @param spender The address of the account which may transfer tokens
    /// @param amount The number of tokens that are approved (2^256-1 means infinite)
    /// @return Whether or not the approval succeeded
    function nTokenTransferApprove(
        uint16 currencyId,
        address owner,
        address spender,
        uint256 amount
    ) external override returns (bool) {
        address nTokenAddress = nTokenHandler.nTokenAddress(currencyId);
        require(msg.sender == nTokenAddress, "Unauthorized caller");

        nTokenAllowance[owner][spender][currencyId] = amount;

        return true;
    }

    /// @notice Transfer `amount` tokens from `msg.sender` to `dst`
    /// @dev Can only be called via the nToken proxy
    /// @param from The address of the destination account
    /// @param amount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function nTokenTransfer(
        uint16 currencyId,
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        address nTokenAddress = nTokenHandler.nTokenAddress(currencyId);
        require(msg.sender == nTokenAddress, "Unauthorized caller");

        return _transfer(currencyId, from, to, amount);
    }

    /// @notice Transfer `amount` tokens from `src` to `dst`
    /// @dev Can only be called via the nToken proxy
    /// @param currencyId Currency id of the nToken
    /// @param spender The address of the original caller
    /// @param from The address of the source account
    /// @param to The address of the destination account
    /// @param amount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function nTokenTransferFrom(
        uint16 currencyId,
        address spender,
        address from,
        address to,
        uint256 amount
    ) external override returns (bool, uint256) {
        address nTokenAddress = nTokenHandler.nTokenAddress(currencyId);
        require(msg.sender == nTokenAddress, "Unauthorized caller");

        uint256 allowance = nTokenWhitelist[from][spender];

        if (allowance > 0) {
            // This whitelist allowance supersedes any specific allowances
            require(allowance >= amount, "Insufficient allowance");
            allowance = allowance.sub(amount);
            nTokenWhitelist[from][spender] = allowance;
        } else {
            // This is the specific allowance for the nToken.
            allowance = nTokenAllowance[from][spender][currencyId];
            require(allowance >= amount, "Insufficient allowance");
            allowance = allowance.sub(amount);
            nTokenAllowance[from][spender][currencyId] = allowance;
        }

        bool success = _transfer(currencyId, from, to, amount);
        return (success, allowance);
    }

    /// @notice Will approve all nToken transfers to the specific sender. This is used for simplifying UX, a user can approve
    /// all token transfers to an external exchange or protocol in a single txn. This must be called directly
    /// on the Notional contract, not available via the ERC20 proxy.
    /// @dev emit:Approval
    /// @param spender The address of the account which may transfer tokens
    /// @param amount The number of tokens that are approved (2^256-1 means infinite)
    /// @return Whether or not the approval succeeded
    function nTokenTransferApproveAll(address spender, uint256 amount)
        external
        override
        returns (bool)
    {
        nTokenWhitelist[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);

        return true;
    }

    /// @notice Claims incentives accrued on all nToken balances and transfers them to the msg.sender
    /// @dev auth:msg.sender
    /// @return Total amount of incentives claimed
    function nTokenClaimIncentives() external override returns (uint256) {
        address account = msg.sender;
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        uint256 totalIncentivesClaimed;
        BalanceState memory balanceState;

        if (accountContext.bitmapCurrencyId != 0) {
            balanceState.loadBalanceState(account, accountContext.bitmapCurrencyId, accountContext);
            if (balanceState.storedNTokenBalance > 0) {
                totalIncentivesClaimed = totalIncentivesClaimed.add(
                    BalanceHandler.claimIncentivesManual(balanceState, account)
                );
            }
        }

        bytes18 currencies = accountContext.activeCurrencies;
        while (currencies != 0) {
            uint256 currencyId = uint256(uint16(bytes2(currencies) & Constants.UNMASK_FLAGS));

            balanceState.loadBalanceState(account, currencyId, accountContext);
            if (balanceState.storedNTokenBalance > 0) {
                totalIncentivesClaimed = totalIncentivesClaimed.add(
                    BalanceHandler.claimIncentivesManual(balanceState, account)
                );
            }

            currencies = currencies << 16;
        }

        // NOTE: no need to set account context after claiming incentives
        return totalIncentivesClaimed;
    }

    /// @notice Returns the present value of the nToken's assets denominated in asset tokens
    function nTokenPresentValueAssetDenominated(uint16 currencyId)
        external
        view
        override
        returns (int256)
    {
        // prettier-ignore
        (
            int256 totalAssetPV,
            /* portfolio */
        ) = _getNTokenPV(currencyId);

        return totalAssetPV;
    }

    /// @notice Returns the present value of the nToken's assets denominated in underlying
    function nTokenPresentValueUnderlyingDenominated(uint16 currencyId)
        external
        view
        override
        returns (int256)
    {
        (int256 totalAssetPV, nTokenPortfolio memory nToken) = _getNTokenPV(currencyId);

        return nToken.cashGroup.assetRate.convertToUnderlying(totalAssetPV);
    }

    function _getNTokenPV(uint256 currencyId)
        private
        view
        returns (int256, nTokenPortfolio memory)
    {
        uint256 blockTime = block.timestamp;
        nTokenPortfolio memory nToken;
        nTokenHandler.loadNTokenPortfolioView(currencyId, nToken);

        // prettier-ignore
        (
            int256 totalAssetPV,
            /* ifCashMapping */
        ) = nTokenHandler.getNTokenAssetPV(nToken, blockTime);

        return (totalAssetPV, nToken);
    }

    /// @notice Transferring tokens will also claim incentives at the same time
    function _transfer(
        uint256 currencyId,
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (bool) {
        {
            // prettier-ignore
            (
                uint256 isNToken,
                /* incentiveAnnualEmissionRate */,
                /* lastInitializedTime */,
                /* parameters */
            ) = nTokenHandler.getNTokenContext(recipient);
            // nTokens cannot hold nToken balances
            require(isNToken == 0, "Cannot transfer to nToken");
        }

        AccountContext memory senderContext = AccountContextHandler.getAccountContext(sender);
        BalanceState memory senderBalance;
        senderBalance.loadBalanceState(sender, currencyId, senderContext);

        AccountContext memory recipientContext = AccountContextHandler.getAccountContext(recipient);
        BalanceState memory recipientBalance;
        recipientBalance.loadBalanceState(recipient, currencyId, recipientContext);

        int256 amountInt = SafeCast.toInt256(amount);
        senderBalance.netNTokenTransfer = amountInt.neg();
        recipientBalance.netNTokenTransfer = amountInt;

        senderBalance.finalize(sender, senderContext, false);
        recipientBalance.finalize(recipient, recipientContext, false);
        senderContext.setAccountContext(sender);
        recipientContext.setAccountContext(recipient);

        emit Transfer(sender, recipient, amount);

        return true;
    }
}
