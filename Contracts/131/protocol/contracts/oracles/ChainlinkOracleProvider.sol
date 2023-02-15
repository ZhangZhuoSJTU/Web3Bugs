// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@chainlink/contracts/Denominations.sol";
import "@chainlink/contracts/interfaces/FeedRegistryInterface.sol";

import "../access/Authorization.sol";

import "../../libraries/Errors.sol";
import "../../libraries/DecimalScale.sol";

import "../../interfaces/oracles/IChainlinkOracleProvider.sol";

contract ChainlinkOracleProvider is IChainlinkOracleProvider, Authorization {
    using DecimalScale for uint256;

    FeedRegistryInterface internal immutable _feedRegistry;

    uint256 public stalePriceDelay;

    event FeedUpdated(address indexed asset, address indexed previousFeed, address indexed newFeed);
    event StalePriceDelaySet(uint256 newStalePriceDelay);

    constructor(IRoleManager roleManager_, address feedRegistry_) Authorization(roleManager_) {
        _feedRegistry = FeedRegistryInterface(feedRegistry_);

        stalePriceDelay = 1 days;
    }

    /**
     * @notice Sets the stale price delay value.
     * @param stalePriceDelay_ The new stale price delay to set.
     */
    function setStalePriceDelay(uint256 stalePriceDelay_) external override onlyGovernance {
        require(stalePriceDelay_ >= 1 hours, Error.INVALID_ARGUMENT);
        stalePriceDelay = stalePriceDelay_;
        emit StalePriceDelaySet(stalePriceDelay_);
    }

    /// @inheritdoc IOracleProvider
    function getPriceETH(address asset_) external view override returns (uint256) {
        return _getPrice(asset_, Denominations.ETH, false);
    }

    /// @inheritdoc IOracleProvider
    function getPriceUSD(address asset_) public view override returns (uint256) {
        return _getPrice(asset_, Denominations.USD, false);
    }

    function _getPrice(
        address asset_,
        address denomination_,
        bool revert_
    ) internal view returns (uint256) {
        try _feedRegistry.latestRoundData(asset_, denomination_) returns (
            uint80 roundID_,
            int256 price_,
            uint256 startedAt,
            uint256 timeStamp_,
            uint80 answeredInRound_
        ) {
            require(timeStamp_ != 0, Error.ROUND_NOT_COMPLETE);
            require(block.timestamp <= timeStamp_ + stalePriceDelay, Error.STALE_PRICE);
            require(price_ != 0, Error.NEGATIVE_PRICE);
            require(answeredInRound_ >= roundID_, Error.STALE_PRICE);

            return uint256(price_).scaleFrom(_feedRegistry.decimals(asset_, denomination_));
        } catch Error(string memory reason) {
            if (revert_) revert(reason);

            if (denomination_ == Denominations.USD) {
                return
                    (_getPrice(asset_, Denominations.ETH, true) *
                        _getPrice(Denominations.ETH, Denominations.USD, true)) / 1e18;
            }
            return
                (_getPrice(asset_, Denominations.USD, true) * 1e18) /
                _getPrice(Denominations.ETH, Denominations.USD, true);
        }
    }
}
