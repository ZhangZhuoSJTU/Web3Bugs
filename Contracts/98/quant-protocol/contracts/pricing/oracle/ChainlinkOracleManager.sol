// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../../interfaces/external/chainlink/IEACAggregatorProxy.sol";
import "../PriceRegistry.sol";
import "./ProviderOracleManager.sol";
import "../../libraries/ProtocolValue.sol";
import "../../libraries/QuantMath.sol";
import "../../interfaces/IChainlinkOracleManager.sol";

/// @title For managing chainlink oracles for assets and submitting chainlink prices to the registry
/// @author Rolla
/// @notice Once an oracle is added for an asset it can't be changed!
contract ChainlinkOracleManager is
    ProviderOracleManager,
    IChainlinkOracleManager
{
    using QuantMath for uint256;
    using QuantMath for QuantMath.FixedPointInt;

    struct BinarySearchResult {
        uint80 firstRound;
        uint80 lastRound;
        uint80 firstRoundProxy;
        uint80 lastRoundProxy;
    }

    uint256 public immutable override fallbackPeriodSeconds;
    uint8 public immutable override strikeAssetDecimals;
    uint8 public constant CHAINLINK_ORACLE_DECIMALS = 8;

    /// @param _config address of quant central configuration
    /// @param _fallbackPeriodSeconds amount of seconds before fallback price submitter can submit
    constructor(
        address _config,
        uint8 _strikeAssetDecimals,
        uint256 _fallbackPeriodSeconds
    ) ProviderOracleManager(_config) {
        fallbackPeriodSeconds = _fallbackPeriodSeconds;
        strikeAssetDecimals = _strikeAssetDecimals;
    }

    /// @inheritdoc IChainlinkOracleManager
    function setExpiryPriceInRegistryByRound(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _roundIdAfterExpiry
    ) external override {
        _setExpiryPriceInRegistryByRound(
            _asset,
            _expiryTimestamp,
            _roundIdAfterExpiry
        );
    }

    /// @inheritdoc IProviderOracleManager
    function setExpiryPriceInRegistry(
        address _asset,
        uint256 _expiryTimestamp,
        bytes memory
    ) external override(ProviderOracleManager, IProviderOracleManager) {
        //search and get round
        uint80 roundAfterExpiry = searchRoundToSubmit(_asset, _expiryTimestamp);

        //submit price to registry
        _setExpiryPriceInRegistryByRound(
            _asset,
            _expiryTimestamp,
            roundAfterExpiry
        );
    }

    /// @inheritdoc IOracleFallbackMechanism
    function setExpiryPriceInRegistryFallback(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _price
    ) external override {
        require(
            config.hasRole(
                config.quantRoles("FALLBACK_PRICE_ROLE"),
                msg.sender
            ),
            "ChainlinkOracleManager: Only the fallback price submitter can submit a fallback price"
        );

        require(
            block.timestamp >= _expiryTimestamp + fallbackPeriodSeconds,
            "ChainlinkOracleManager: The fallback price period has not passed since the timestamp"
        );

        emit PriceRegistrySubmission(
            _asset,
            _expiryTimestamp,
            _price,
            0,
            msg.sender,
            true
        );

        PriceRegistry(
            config.protocolAddresses(ProtocolValue.encode("priceRegistry"))
        ).setSettlementPrice(
                _asset,
                _expiryTimestamp,
                _price,
                CHAINLINK_ORACLE_DECIMALS
            );
    }

    /// @inheritdoc IProviderOracleManager
    function getCurrentPrice(address _asset)
        external
        view
        override(ProviderOracleManager, IProviderOracleManager)
        returns (uint256)
    {
        address assetOracle = getAssetOracle(_asset);
        IEACAggregatorProxy aggregator = IEACAggregatorProxy(assetOracle);
        int256 answer = aggregator.latestAnswer();
        require(
            answer > 0,
            "ChainlinkOracleManager: No pricing data available"
        );

        return
            uint256(answer)
                .fromScaledUint(CHAINLINK_ORACLE_DECIMALS)
                .toScaledUint(strikeAssetDecimals, true);
    }

    /// @inheritdoc IProviderOracleManager
    function isValidOption(
        address,
        uint256,
        uint256
    )
        public
        view
        virtual
        override(ProviderOracleManager, IProviderOracleManager)
        returns (bool)
    {
        return true;
    }

    /// @inheritdoc IChainlinkOracleManager
    function searchRoundToSubmit(address _asset, uint256 _expiryTimestamp)
        public
        view
        override
        returns (uint80)
    {
        address assetOracle = getAssetOracle(_asset);

        IEACAggregatorProxy aggregator = IEACAggregatorProxy(assetOracle);

        require(
            aggregator.latestTimestamp() > _expiryTimestamp,
            "ChainlinkOracleManager: The latest round timestamp is not after the expiry timestamp"
        );

        uint80 latestRound = uint80(aggregator.latestRound());

        uint16 phaseOffset = 64;
        uint16 phaseId = uint16(latestRound >> phaseOffset);

        uint80 lowestPossibleRound = uint80((phaseId << phaseOffset) | 1);
        uint80 highestPossibleRound = latestRound;
        uint80 firstId = lowestPossibleRound;
        uint80 lastId = highestPossibleRound;

        require(
            lastId > firstId,
            "ChainlinkOracleManager: Not enough rounds to find round after"
        );

        //binary search until we find two values our desired timestamp lies between
        while (lastId - firstId != 1) {
            BinarySearchResult memory result = _binarySearchStep(
                aggregator,
                _expiryTimestamp,
                lowestPossibleRound,
                highestPossibleRound
            );

            lowestPossibleRound = result.firstRound;
            highestPossibleRound = result.lastRound;
            firstId = result.firstRoundProxy;
            lastId = result.lastRoundProxy;
        }

        return highestPossibleRound; //return round above
    }

    /// @notice Get the expiry price from chainlink asset oracle and store it in the price registry
    /// @param _asset asset to set price of
    /// @param _expiryTimestamp timestamp of price
    /// @param _roundIdAfterExpiry the chainlink round id immediately after the option expired
    function _setExpiryPriceInRegistryByRound(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _roundIdAfterExpiry
    ) internal {
        address assetOracle = getAssetOracle(_asset);

        IEACAggregatorProxy aggregator = IEACAggregatorProxy(assetOracle);

        require(
            aggregator.getTimestamp(uint256(_roundIdAfterExpiry)) >
                _expiryTimestamp,
            "ChainlinkOracleManager: The round posted is not after the expiry timestamp"
        );

        uint16 phaseOffset = 64;
        uint16 phaseId = uint16(_roundIdAfterExpiry >> phaseOffset);

        uint64 expiryRound = uint64(_roundIdAfterExpiry) - 1;
        uint80 expiryRoundId = uint80(
            (uint256(phaseId) << phaseOffset) | expiryRound
        );

        require(
            aggregator.getTimestamp(uint256(expiryRoundId)) <= _expiryTimestamp,
            "ChainlinkOracleManager: Expiry round prior to the one posted is after the expiry timestamp"
        );

        (uint256 price, uint256 roundId) = _getExpiryPrice(
            aggregator,
            _expiryTimestamp,
            _roundIdAfterExpiry,
            expiryRoundId
        );

        emit PriceRegistrySubmission(
            _asset,
            _expiryTimestamp,
            price,
            roundId,
            msg.sender,
            false
        );

        PriceRegistry(
            config.protocolAddresses(ProtocolValue.encode("priceRegistry"))
        ).setSettlementPrice(
                _asset,
                _expiryTimestamp,
                price,
                CHAINLINK_ORACLE_DECIMALS
            );
    }

    function _getExpiryPrice(
        IEACAggregatorProxy aggregator,
        uint256,
        uint256,
        uint256 _expiryRoundId
    ) internal view virtual returns (uint256, uint256) {
        return (uint256(aggregator.getAnswer(_expiryRoundId)), _expiryRoundId);
    }

    /// @notice Performs a binary search step between the first and last round in the aggregator proxy
    /// @param _expiryTimestamp expiry timestamp to find the price at
    /// @param _firstRoundProxy the lowest possible round for the timestamp
    /// @param _lastRoundProxy the highest possible round for the timestamp
    /// @return a binary search result object representing lowest and highest possible rounds of the timestamp
    function _binarySearchStep(
        IEACAggregatorProxy aggregator,
        uint256 _expiryTimestamp,
        uint80 _firstRoundProxy,
        uint80 _lastRoundProxy
    ) internal view returns (BinarySearchResult memory) {
        uint16 phaseOffset = 64;
        uint16 phaseId = uint16(_lastRoundProxy >> phaseOffset);

        uint64 lastRoundId = uint64(_lastRoundProxy);
        uint64 firstRoundId = uint64(_firstRoundProxy);

        uint80 roundToCheck = uint80(
            (uint256(firstRoundId) + uint256(lastRoundId)) / 2
        );
        uint80 roundToCheckProxy = uint80(
            (uint256(phaseId) << phaseOffset) | roundToCheck
        );

        uint256 roundToCheckTimestamp = aggregator.getTimestamp(
            uint256(roundToCheckProxy)
        );

        if (roundToCheckTimestamp <= _expiryTimestamp) {
            return
                BinarySearchResult(
                    roundToCheckProxy,
                    _lastRoundProxy,
                    roundToCheck,
                    lastRoundId
                );
        }

        return
            BinarySearchResult(
                _firstRoundProxy,
                roundToCheckProxy,
                firstRoundId,
                roundToCheck
            );
    }
}
