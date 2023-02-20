// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/AccountContextHandler.sol";
import "../internal/balances/BalanceHandler.sol";
import "../global/StorageLayoutV1.sol";

contract MockBalanceHandler is StorageLayoutV1 {
    using BalanceHandler for BalanceState;
    using AccountContextHandler for AccountContext;

    function setMaxCurrencyId(uint16 num) external {
        maxCurrencyId = num;
    }

    function getCurrencyMapping(uint256 id, bool underlying) external view returns (Token memory) {
        return TokenHandler.getToken(id, underlying);
    }

    function setCurrencyMapping(
        uint256 id,
        bool underlying,
        TokenStorage calldata ts
    ) external {
        TokenHandler.setToken(id, underlying, ts);
    }

    function setAccountContext(address account, AccountContext memory a) external {
        a.setAccountContext(account);
    }

    function setBalance(
        address account,
        uint256 currencyId,
        int256 cashBalance,
        int256 nTokenBalance
    ) external {
        bytes32 slot = keccak256(
            abi.encode(currencyId, keccak256(abi.encode(account, Constants.BALANCE_STORAGE_OFFSET)))
        );
        require(cashBalance >= type(int88).min && cashBalance <= type(int88).max); // dev: stored cash balance overflow
        // Allows for 12 quadrillion nToken balance in 1e8 decimals before overflow
        require(nTokenBalance >= 0 && nTokenBalance <= type(uint80).max); // dev: stored nToken balance overflow

        bytes32 data = ((bytes32(uint256(nTokenBalance))) |
            (bytes32(0) << 80) |
            (bytes32(0) << 112) |
            (bytes32(cashBalance) << 168));

        assembly {
            sstore(slot, data)
        }
    }

    function getData(address account, uint256 currencyId) external view returns (bytes32) {
        bytes32 slot = keccak256(abi.encode(currencyId, account, "account.balances"));
        bytes32 data;
        assembly {
            data := sload(slot)
        }

        return data;
    }

    function finalize(
        BalanceState memory balanceState,
        address account,
        AccountContext memory accountContext,
        bool redeemToUnderlying
    ) public returns (AccountContext memory) {
        balanceState.finalize(account, accountContext, redeemToUnderlying);

        return accountContext;
    }

    function loadBalanceState(
        address account,
        uint256 currencyId,
        AccountContext memory accountContext
    ) public view returns (BalanceState memory, AccountContext memory) {
        BalanceState memory bs;
        bs.loadBalanceState(account, currencyId, accountContext);

        return (bs, accountContext);
    }

    function depositAssetToken(
        BalanceState memory balanceState,
        address account,
        int256 assetAmountExternal,
        bool forceTransfer
    ) external returns (BalanceState memory, int256) {
        int256 assetAmountInternal = balanceState.depositAssetToken(
            account,
            assetAmountExternal,
            forceTransfer
        );

        return (balanceState, assetAmountInternal);
    }

    function depositUnderlyingToken(
        BalanceState memory balanceState,
        address account,
        int256 underlyingAmountExternal
    ) external returns (BalanceState memory, int256) {
        int256 assetTokensReceivedInternal = balanceState.depositUnderlyingToken(
            account,
            underlyingAmountExternal
        );

        return (balanceState, assetTokensReceivedInternal);
    }
}
