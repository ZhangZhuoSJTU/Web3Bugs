// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/AccountContextHandler.sol";

contract MockAccountContextHandler {
    using AccountContextHandler for AccountContext;

    function setAssetBitmap(
        address account,
        uint256 id,
        bytes32 bitmap
    ) external {
        BitmapAssetsHandler.setAssetsBitmap(account, id, bitmap);
    }

    function enableBitmapForAccount(
        address account,
        uint256 currencyId,
        uint256 blockTime
    ) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        accountContext.enableBitmapForAccount(account, currencyId, blockTime);
        accountContext.setAccountContext(account);
    }

    function getAccountContext(address account) external view returns (AccountContext memory) {
        return AccountContextHandler.getAccountContext(account);
    }

    function setAccountContext(AccountContext memory accountContext, address account) external {
        return accountContext.setAccountContext(account);
    }

    function isActiveInBalances(AccountContext memory accountContext, uint256 currencyId)
        external
        pure
        returns (bool)
    {
        return accountContext.isActiveInBalances(currencyId);
    }

    function clearPortfolioActiveFlags(bytes18 activeCurrencies) external pure returns (bytes18) {
        return AccountContextHandler._clearPortfolioActiveFlags(activeCurrencies);
    }

    function setActiveCurrency(
        bytes18 activeCurrencies,
        uint256 currencyId,
        bool isActive,
        bytes2 flags,
        uint16 bitmapId
    ) external pure returns (bytes18) {
        AccountContext memory accountContext =
            AccountContext(0, 0x00, 0, bitmapId, activeCurrencies);
        accountContext.setActiveCurrency(currencyId, isActive, flags);

        // Assert that the currencies are in order
        bytes18 currencies = accountContext.activeCurrencies;
        uint256 lastCurrency;
        while (currencies != 0x0) {
            uint256 thisCurrency = uint256(uint16(bytes2(currencies) & Constants.UNMASK_FLAGS));
            assert(thisCurrency != 0);
            // Either flag must be set
            assert(
                ((bytes2(currencies) & Constants.ACTIVE_IN_PORTFOLIO) ==
                    Constants.ACTIVE_IN_PORTFOLIO) ||
                    ((bytes2(currencies) & Constants.ACTIVE_IN_BALANCES) ==
                        Constants.ACTIVE_IN_BALANCES)
            );
            // currencies are in order
            assert(thisCurrency > lastCurrency);

            if (isActive && currencyId == thisCurrency) {
                assert(bytes2(currencies) & flags == flags);
            } else if (!isActive && currencyId == thisCurrency) {
                assert(bytes2(currencies) & flags != flags);
            }

            lastCurrency = thisCurrency;
            currencies = currencies << 16;
        }

        // Bitmap id should never change in this method
        assert(accountContext.bitmapCurrencyId == bitmapId);

        return accountContext.activeCurrencies;
    }
}
