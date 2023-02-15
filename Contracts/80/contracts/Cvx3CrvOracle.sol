// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.6;

import "@yield-protocol/utils-v2/contracts/access/AccessControl.sol";
import "@yield-protocol/vault-interfaces/IOracle.sol";
import "@yield-protocol/utils-v2/contracts/cast/CastBytes32Bytes6.sol";

import "./interfaces/ICurvePool.sol";
import "./interfaces/AggregatorV3Interface.sol";

// Oracle Code Inspiration: https://github.com/Abracadabra-money/magic-internet-money/blob/main/contracts/oracles/3CrvOracle.sol
/**
 *@title  Cvx3CrvOracle
 *@notice Provides current values for Cvx3Crv
 *@dev    Both peek() (view) and get() (transactional) are provided for convenience
 */
contract Cvx3CrvOracle is IOracle, AccessControl {
    using CastBytes32Bytes6 for bytes32;
    ICurvePool public threecrv;
    AggregatorV3Interface public DAI;
    AggregatorV3Interface public USDC;
    AggregatorV3Interface public USDT;

    bytes32 public cvx3CrvId;
    bytes32 public ethId;

    /**
     *@notice Set threecrv pool and the chainlink sources
     *@param  cvx3CrvId_ cvx3crv Id
     *@param  ethId_ ETH ID
     *@param  threecrv_ The 3CRV pool address
     *@param  DAI_ DAI/ETH chainlink price feed address
     *@param  USDC_ USDC/ETH chainlink price feed address
     *@param  USDT_ USDT/ETH chainlink price feed address
     */
    function setSource(
        bytes32 cvx3CrvId_,
        bytes32 ethId_,
        ICurvePool threecrv_,
        AggregatorV3Interface DAI_,
        AggregatorV3Interface USDC_,
        AggregatorV3Interface USDT_
    ) external auth {
        cvx3CrvId = cvx3CrvId_;
        ethId = ethId_;
        threecrv = threecrv_;
        DAI = DAI_;
        USDC = USDC_;
        USDT = USDT_;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @dev Only cvx3crvid and ethId are accepted as asset identifiers.
     * @param base Id of base token
     * @param quote Id of quoted token
     * @return quoteAmount Total amount in terms of quoted token
     * @return updateTime Time quote was last updated
     */
    function peek(
        bytes32 base,
        bytes32 quote,
        uint256 baseAmount
    )
        external
        view
        virtual
        override
        returns (uint256 quoteAmount, uint256 updateTime)
    {
        return _peek(base.b6(), quote.b6(), baseAmount);
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price. Same as `peek` for this oracle.
     * @dev Only cvx3crvid and ethId are accepted as asset identifiers.
     * @param base Id of base token
     * @param quote Id of quoted token
     * @return quoteAmount Total amount in terms of quoted token
     * @return updateTime Time quote was last updated
     */
    function get(
        bytes32 base,
        bytes32 quote,
        uint256 baseAmount
    )
        external
        virtual
        override
        returns (uint256 quoteAmount, uint256 updateTime)
    {
        return _peek(base.b6(), quote.b6(), baseAmount);
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @dev Only cvx3crvid and ethId are accepted as asset identifiers.
     * @param base Id of base token
     * @param quote Id of quoted token
     * @return quoteAmount Total amount in terms of quoted token
     * @return updateTime Time quote was last updated
     */
    function _peek(
        bytes6 base,
        bytes6 quote,
        uint256 baseAmount
    ) private view returns (uint256 quoteAmount, uint256 updateTime) {
        require(
            (base == ethId && quote == cvx3CrvId) ||
                (base == cvx3CrvId && quote == ethId),
            "Invalid quote or base"
        );
        (, int256 daiPrice, , , ) = DAI.latestRoundData();
        (, int256 usdcPrice, , , ) = USDC.latestRoundData();
        (, int256 usdtPrice, , , ) = USDT.latestRoundData();

        require(
            daiPrice > 0 && usdcPrice > 0 && usdtPrice > 0,
            "Chainlink pricefeed reporting 0"
        );

        // This won't overflow as the max value for int256 is less than the max value for uint256
        uint256 minStable = min(
            uint256(daiPrice),
            min(uint256(usdcPrice), uint256(usdtPrice))
        );

        uint256 price = (threecrv.get_virtual_price() * minStable) / 1e18;

        if (base == cvx3CrvId && quote == ethId) {
            quoteAmount = (baseAmount * price) / 1e18;
        } else {
            quoteAmount = (baseAmount * 1e18) / price;
        }

        updateTime = block.timestamp;
    }
}
