// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/valuation/ExchangeRate.sol";
import "../global/StorageLayoutV1.sol";

contract MockExchangeRate is StorageLayoutV1 {
    using SafeInt256 for int256;
    using ExchangeRate for ETHRate;

    function setETHRateMapping(uint256 id, ETHRateStorage calldata rs) external {
        underlyingToETHRateMapping[id] = rs;
    }

    function assertBalanceSign(int256 balance, int256 result) private pure {
        if (balance == 0) assert(result == 0);
        else if (balance < 0) assert(result < 0);
        else if (balance > 0) assert(result > 0);
    }

    // Prove that exchange rates move in the correct direction
    function assertRateDirection(
        int256 base,
        int256 quote,
        ETHRate memory er
    ) private pure {
        require(er.rate > 0);
        if (base == 0) return;

        if (er.rate == er.rateDecimals) {
            assert(quote.abs() == base.abs());
        } else if (er.rate < er.rateDecimals) {
            assert(quote.abs() < base.abs());
        } else if (er.rate > er.rateDecimals) {
            assert(quote.abs() > base.abs());
        }
    }

    function convertToETH(ETHRate memory er, int256 balance) external pure returns (int256) {
        require(er.rate > 0);
        int256 result = er.convertToETH(balance);
        assertBalanceSign(balance, result);

        return result;
    }

    function convertETHTo(ETHRate memory er, int256 balance) external pure returns (int256) {
        require(er.rate > 0);
        int256 result = er.convertETHTo(balance);
        assertBalanceSign(balance, result);
        assertRateDirection(result, balance, er);

        return result;
    }

    function exchangeRate(ETHRate memory baseER, ETHRate memory quoteER)
        external
        pure
        returns (int256)
    {
        require(baseER.rate > 0);
        require(quoteER.rate > 0);

        int256 result = baseER.exchangeRate(quoteER);
        assert(result > 0);

        return result;
    }

    function buildExchangeRate(uint256 currencyId) external view returns (ETHRate memory) {
        return ExchangeRate.buildExchangeRate(currencyId);
    }
}
