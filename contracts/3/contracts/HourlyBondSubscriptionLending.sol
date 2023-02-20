// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./BaseLending.sol";

struct HourlyBond {
    uint256 amount;
    uint256 yieldQuotientFP;
    uint256 moduloHour;
}

/// @title Here we offer subscriptions to auto-renewing hourly bonds
/// Funds are locked in for an 50 minutes per hour, while interest rates float
abstract contract HourlyBondSubscriptionLending is BaseLending {
    struct HourlyBondMetadata {
        YieldAccumulator yieldAccumulator;
        uint256 buyingSpeed;
        uint256 withdrawingSpeed;
        uint256 lastBought;
        uint256 lastWithdrawn;
    }

    mapping(address => HourlyBondMetadata) hourlyBondMetadata;

    uint256 public withdrawalWindow = 10 minutes;
    // issuer => holder => bond record
    mapping(address => mapping(address => HourlyBond))
        public hourlyBondAccounts;

    uint256 public borrowingFactorPercent = 200;

    /// Set withdrawal window
    function setWithdrawalWindow(uint256 window) external onlyOwner {
        withdrawalWindow = window;
    }

    function _makeHourlyBond(
        address issuer,
        address holder,
        uint256 amount
    ) internal {
        HourlyBond storage bond = hourlyBondAccounts[issuer][holder];
        updateHourlyBondAmount(issuer, bond);

        HourlyBondMetadata storage bondMeta = hourlyBondMetadata[issuer];
        bond.yieldQuotientFP = bondMeta.yieldAccumulator.accumulatorFP;
        bond.moduloHour = block.timestamp % (1 hours);
        bond.amount += amount;
        lendingMeta[issuer].totalLending += amount;

        (bondMeta.buyingSpeed, bondMeta.lastBought) = updateSpeed(
            bondMeta.buyingSpeed,
            bondMeta.lastBought,
            amount,
            1 hours
        );
    }

    function updateHourlyBondAmount(address issuer, HourlyBond storage bond)
        internal
    {
        uint256 yieldQuotientFP = bond.yieldQuotientFP;
        if (yieldQuotientFP > 0) {
            YieldAccumulator storage yA =
                getUpdatedHourlyYield(issuer, hourlyBondMetadata[issuer]);

            uint256 oldAmount = bond.amount;
            bond.amount = applyInterest(
                bond.amount,
                yA.accumulatorFP,
                yieldQuotientFP
            );

            uint256 deltaAmount = bond.amount - oldAmount;
            lendingMeta[issuer].totalLending += deltaAmount;
        }
    }

    // Retrieves bond balance for issuer and holder
    function viewHourlyBondAmount(address issuer, address holder)
        public
        view
        returns (uint256)
    {
        HourlyBond storage bond = hourlyBondAccounts[issuer][holder];
        uint256 yieldQuotientFP = bond.yieldQuotientFP;

        uint256 cumulativeYield =
            viewCumulativeYieldFP(
                hourlyBondMetadata[issuer].yieldAccumulator,
                block.timestamp
            );

        if (yieldQuotientFP > 0) {
            return
                bond.amount +
                applyInterest(bond.amount, cumulativeYield, yieldQuotientFP);
        }
        return bond.amount + 0;
    }

    function _withdrawHourlyBond(
        address issuer,
        HourlyBond storage bond,
        uint256 amount
    ) internal {
        // how far the current hour has advanced (relative to acccount hourly clock)
        uint256 currentOffset = (block.timestamp - bond.moduloHour) % (1 hours);

        require(
            withdrawalWindow >= currentOffset,
            "Tried withdrawing outside subscription cancellation time window"
        );

        bond.amount -= amount;
        lendingMeta[issuer].totalLending -= amount;

        HourlyBondMetadata storage bondMeta = hourlyBondMetadata[issuer];
        (bondMeta.withdrawingSpeed, bondMeta.lastWithdrawn) = updateSpeed(
            bondMeta.withdrawingSpeed,
            bondMeta.lastWithdrawn,
            bond.amount,
            1 hours
        );
    }

    function calcCumulativeYieldFP(
        YieldAccumulator storage yieldAccumulator,
        uint256 timeDelta
    ) internal view returns (uint256 accumulatorFP) {
        uint256 secondsDelta = timeDelta % (1 hours);
        // linearly interpolate interest for seconds
        // accumulator * hourly_yield == seconds_per_hour * accumulator * hourly_yield / seconds_per_hour
        // FP * FP * 1 / (FP * 1) = FP
        accumulatorFP =
            (yieldAccumulator.accumulatorFP *
                yieldAccumulator.hourlyYieldFP *
                secondsDelta) /
            (FP32 * 1 hours);

        uint256 hoursDelta = timeDelta / (1 hours);
        if (hoursDelta > 0) {
            // This loop should hardly ever 1 or more unless something bad happened
            // In which case it costs gas but there isn't overflow
            for (uint256 i = 0; hoursDelta > i; i++) {
                // FP32 * FP32 / FP32 = FP32
                accumulatorFP =
                    (accumulatorFP * yieldAccumulator.hourlyYieldFP) /
                    FP32;
            }
        }
    }

    /// @dev updates yield accumulators for both borrowing and lending
    function getUpdatedHourlyYield(
        address issuer,
        HourlyBondMetadata storage bondMeta
    ) internal returns (YieldAccumulator storage accumulator) {
        accumulator = bondMeta.yieldAccumulator;
        uint256 timeDelta = (block.timestamp - accumulator.lastUpdated);

        accumulator.accumulatorFP = calcCumulativeYieldFP(
            accumulator,
            timeDelta
        );

        LendingMetadata storage meta = lendingMeta[issuer];
        YieldAccumulator storage borrowAccumulator =
            borrowYieldAccumulators[issuer];

        uint256 yieldGeneratedFP =
            (borrowAccumulator.hourlyYieldFP * meta.totalBorrowed) /
                (1 + meta.totalLending);
        uint256 _maxHourlyYieldFP = min(maxHourlyYieldFP, yieldGeneratedFP);

        accumulator.hourlyYieldFP = updatedYieldFP(
            accumulator.hourlyYieldFP,
            accumulator.lastUpdated,
            meta.totalLending,
            lendingTarget(meta),
            bondMeta.buyingSpeed,
            bondMeta.withdrawingSpeed,
            _maxHourlyYieldFP
        );

        timeDelta = block.timestamp - borrowAccumulator.lastUpdated;
        borrowAccumulator.accumulatorFP = calcCumulativeYieldFP(
            borrowAccumulator,
            timeDelta
        );

        borrowAccumulator.hourlyYieldFP =
            1 +
            (borrowingFactorPercent * accumulator.hourlyYieldFP) /
            100;

        accumulator.lastUpdated = block.timestamp;
        borrowAccumulator.lastUpdated = block.timestamp;
    }

    function viewCumulativeYieldFP(
        YieldAccumulator storage yA,
        uint256 timestamp
    ) internal view returns (uint256) {
        uint256 timeDelta = (timestamp - yA.lastUpdated);
        return calcCumulativeYieldFP(yA, timeDelta);
    }
}
