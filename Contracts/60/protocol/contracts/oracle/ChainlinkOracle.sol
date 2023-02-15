// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../interfaces/IOracle.sol";
import "../utils/types/UFixed18.sol";
import "../utils/unstructured/UOwnable.sol";

/**
 * @title ChainlinkOracle
 * @notice Chainlink implementation of the IOracle interface.
 * @dev One instance per Chainlink price feed should be deployed. Multiple products may use the same
 *      ChainlinkOracle instance if their payoff functions are based on the same underlying oracle.
 */
contract ChainlinkOracle is IOracle, UOwnable {

    event MinDelayUpdated(uint256 newMinDelay);

    /// @dev Chainlink price feed to read from
    IChainlinkFeed public feed;

    /// @dev Mapping of historical price at each oracle version
    Fixed18[] public priceAtVersion;

    /// @dev Mapping of historical timestamp at each oracle version
    uint256[] public timestampAtVersion;

    /// @dev Decimal offset used to normalize chainlink price to 18 decimals
    uint256 private _decimalOffset;

    /// @dev Minimum timestamp delay before committed a new version
    uint256 public minDelay;

    /**
     * @notice Initializes the contract state
     * @param feed_ Chainlink price feed
     */
    constructor(IChainlinkFeed feed_) {
        feed = feed_;
        _decimalOffset = 10 ** feed_.decimals();
        minDelay = 30 minutes;

        sync();
        UOwnable__initialize();
    }

    /**
     * @notice Checks for a new price and updates the oracle version if one is found
     */
    function sync() public {
        (, int256 feedPrice, , uint256 timestamp, ) = feed.latestRoundData();
        Fixed18 price = Fixed18Lib.ratio(feedPrice, SafeCast.toInt256(_decimalOffset));

        if (priceAtVersion.length == 0 || timestamp > timestampAtVersion[currentVersion()] + minDelay) {
            priceAtVersion.push(price);
            timestampAtVersion.push(timestamp);

            emit Version(currentVersion(), timestamp, price);
        }
    }

    /**
     * @notice Returns the current oracle version
     * @return Current oracle version
     */
    function currentVersion() public view returns (uint256) {
        return priceAtVersion.length - 1;
    }

    /**
     * @notice Updates the minimum delay before a new version can be committed
     * @param newMinDelay New minimum delay
     */
    function updateMinDelay(uint256 newMinDelay) onlyOwner external {
        minDelay = newMinDelay;
        emit MinDelayUpdated(newMinDelay);
    }
}

interface IChainlinkFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundID,
        int price,
        uint startedAt,
        uint timeStamp,
        uint80 answeredInRound
    );
}
