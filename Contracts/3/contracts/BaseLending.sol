// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "./RoleAware.sol";

/// @title Base lending behavior
abstract contract BaseLending is Ownable {
    uint256 constant FP32 = 2**32;
    uint256 constant ACCUMULATOR_INIT = 10**18;

    struct YieldAccumulator {
        uint256 accumulatorFP;
        uint256 lastUpdated;
        uint256 hourlyYieldFP;
    }

    struct LendingMetadata {
        uint256 totalLending;
        uint256 totalBorrowed;
        uint256 lendingBuffer;
        uint256 lendingCap;
    }
    mapping(address => LendingMetadata) public lendingMeta;

    /// @dev accumulate interest per issuer (like compound indices)
    mapping(address => YieldAccumulator) public borrowYieldAccumulators;

    uint256 public maxHourlyYieldFP;
    uint256 public yieldChangePerSecondFP;

    /// @dev simple formula for calculating interest relative to accumulator
    function applyInterest(
        uint256 balance,
        uint256 accumulatorFP,
        uint256 yieldQuotientFP
    ) internal pure returns (uint256) {
        // 1 * FP / FP = 1
        return (balance * accumulatorFP) / yieldQuotientFP;
    }

    /// update the yield for an asset based on recent supply and demand
    function updatedYieldFP(
        // previous yield
        uint256 _yieldFP,
        // timestamp
        uint256 lastUpdated,
        uint256 totalLendingInBucket,
        uint256 bucketTarget,
        uint256 buyingSpeed,
        uint256 withdrawingSpeed,
        uint256 bucketMaxYield
    ) internal view returns (uint256 yieldFP) {
        yieldFP = _yieldFP;
        uint256 timeDiff = block.timestamp - lastUpdated;
        uint256 yieldDiff = timeDiff * yieldChangePerSecondFP;

        if (
            totalLendingInBucket >= bucketTarget ||
            buyingSpeed >= withdrawingSpeed
        ) {
            yieldFP -= min(yieldFP, yieldDiff);
        } else {
            yieldFP += yieldDiff;
            if (yieldFP > bucketMaxYield) {
                yieldFP = bucketMaxYield;
            }
        }
    }

    function updateSpeed(
        uint256 speed,
        uint256 lastAction,
        uint256 amount,
        uint256 runtime
    ) internal view returns (uint256 newSpeed, uint256 newLastAction) {
        uint256 timeDiff = block.timestamp - lastAction;
        uint256 updateAmount = (amount * runtime) / (timeDiff + 1);

        uint256 oldSpeedWeight = (runtime + 120 minutes) / 3;
        uint256 updateWeight = timeDiff + 1;
        // scale adjustment relative to runtime
        newSpeed =
            (speed * oldSpeedWeight + updateAmount * updateWeight) /
            (oldSpeedWeight + updateWeight);
        newLastAction = block.timestamp;
    }

    /// @dev minimum
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }

    function _makeFallbackBond(
        address issuer,
        address holder,
        uint256 amount
    ) internal virtual;

    function lendingTarget(LendingMetadata storage meta)
        internal
        view
        returns (uint256)
    {
        return min(meta.lendingCap, meta.totalBorrowed + meta.lendingBuffer);
    }

    /// View lending target
    function viewLendingTarget(address issuer) external view returns (uint256) {
        LendingMetadata storage meta = lendingMeta[issuer];
        return lendingTarget(meta);
    }

    /// Set maximum hourly yield in floating point
    function setMaxHourlyYieldFP(uint256 maxYieldFP) external onlyOwner {
        maxHourlyYieldFP = maxYieldFP;
    }

    /// Set yield change per second in floating point
    function setYieldChangePerSecondFP(uint256 changePerSecondFP)
        external
        onlyOwner
    {
        yieldChangePerSecondFP = changePerSecondFP;
    }

    /// Available tokens to this issuance
    function issuanceBalance(address issuance)
        internal
        view
        virtual
        returns (uint256);
}
