// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/nTokenHandler.sol";
import "../global/StorageLayoutV1.sol";

contract MockNTokenHandler is StorageLayoutV1 {
    function setIncentiveEmissionRate(address tokenAddress, uint32 newEmissionsRate) external {
        nTokenHandler.setIncentiveEmissionRate(tokenAddress, newEmissionsRate);
    }

    function getNTokenContext(address tokenAddress)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            bytes6
        )
    {
        (
            uint256 currencyId,
            uint256 incentiveRate,
            uint256 lastInitializedTime,
            bytes6 parameters
        ) = nTokenHandler.getNTokenContext(tokenAddress);
        assert(nTokenHandler.nTokenAddress(currencyId) == tokenAddress);

        return (currencyId, incentiveRate, lastInitializedTime, parameters);
    }

    function nTokenAddress(uint256 currencyId) external view returns (address) {
        address tokenAddress = nTokenHandler.nTokenAddress(currencyId);
        // prettier-ignore
        (
            uint256 currencyIdStored,
            /* incentiveRate */,
            /* lastInitializedTime */,
            /* parameters */
        ) = nTokenHandler.getNTokenContext(tokenAddress);
        assert(currencyIdStored == currencyId);

        return tokenAddress;
    }

    function setArrayLengthAndInitializedTime(
        address tokenAddress,
        uint8 arrayLength,
        uint256 lastInitializedTime
    ) external {
        nTokenHandler.setArrayLengthAndInitializedTime(
            tokenAddress,
            arrayLength,
            lastInitializedTime
        );
    }

    function changeNTokenSupply(
        address tokenAddress,
        int256 netChange,
        uint256 blockTime
    ) external returns (uint256) {
        return nTokenHandler.changeNTokenSupply(tokenAddress, netChange, blockTime);
    }

    function getStoredNTokenSupplyFactors(address tokenAddress)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return nTokenHandler.getStoredNTokenSupplyFactors(tokenAddress);
    }

    function setNTokenAddress(uint16 currencyId, address tokenAddress) external {
        nTokenHandler.setNTokenAddress(currencyId, tokenAddress);

        // Test the assertions
        this.nTokenAddress(currencyId);
        this.getNTokenContext(tokenAddress);
    }

    function getDepositParameters(uint256 currencyId, uint256 maxMarketIndex)
        external
        view
        returns (int256[] memory, int256[] memory)
    {
        return nTokenHandler.getDepositParameters(currencyId, maxMarketIndex);
    }

    function setDepositParameters(
        uint256 currencyId,
        uint32[] calldata depositShares,
        uint32[] calldata leverageThresholds
    ) external {
        nTokenHandler.setDepositParameters(currencyId, depositShares, leverageThresholds);
    }

    function getInitializationParameters(uint256 currencyId, uint256 maxMarketIndex)
        external
        view
        returns (int256[] memory, int256[] memory)
    {
        return nTokenHandler.getInitializationParameters(currencyId, maxMarketIndex);
    }

    function setInitializationParameters(
        uint256 currencyId,
        uint32[] calldata annualizedAnchorRates,
        uint32[] calldata proportions
    ) external {
        nTokenHandler.setInitializationParameters(currencyId, annualizedAnchorRates, proportions);
    }

    function getNTokenAssetPV(uint256 currencyId, uint256 blockTime)
        external
        view
        returns (int256)
    {
        nTokenPortfolio memory nToken;
        nTokenHandler.loadNTokenPortfolioView(currencyId, nToken);

        (
            int256 assetPv, /* ifCashBitmap */

        ) = nTokenHandler.getNTokenAssetPV(nToken, blockTime);

        return assetPv;
    }

    function updateNTokenCollateralParameters(
        uint16 currencyId,
        uint8 residualPurchaseIncentive10BPS,
        uint8 pvHaircutPercentage,
        uint8 residualPurchaseTimeBufferHours,
        uint8 cashWithholdingBuffer10BPS,
        uint8 liquidationHaircutPercentage
    ) external {
        address tokenAddress = nTokenHandler.nTokenAddress(currencyId);
        require(tokenAddress != address(0), "Invalid currency");

        nTokenHandler.setNTokenCollateralParameters(
            tokenAddress,
            residualPurchaseIncentive10BPS,
            pvHaircutPercentage,
            residualPurchaseTimeBufferHours,
            cashWithholdingBuffer10BPS,
            liquidationHaircutPercentage
        );
    }
}
