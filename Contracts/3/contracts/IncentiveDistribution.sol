// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./RoleAware.sol";
import "./Fund.sol";

struct Claim {
    uint256 startingRewardRateFP;
    uint256 amount;
    uint256 intraDayGain;
    uint256 intraDayLoss;
}

/// @title Manage distribution of liquidity stake incentives
/// Some efforts have been made to reduce gas cost at claim time
/// and shift gas burden onto those who would want to withdraw
contract IncentiveDistribution is RoleAware, Ownable {
    // fixed point number factor
    uint256 internal constant FP32 = 2**32;
    // the amount of contraction per thousand, per day
    // of the overal daily incentive distribution
    // https://en.wikipedia.org/wiki/Per_mil
    uint256 public constant contractionPerMil = 999;
    address public immutable MFI;

    constructor(
        address _MFI,
        uint256 startingDailyDistributionWithoutDecimals,
        address _roles
    ) RoleAware(_roles) Ownable() {
        MFI = _MFI;
        currentDailyDistribution =
            startingDailyDistributionWithoutDecimals *
            (1 ether);
    }

    // how much is going to be distributed, contracts every day
    uint256 public currentDailyDistribution;

    uint256 public trancheShareTotal;
    uint256[] public allTranches;

    struct TrancheMeta {
        // portion of daily distribution per each tranche
        uint256 rewardShare;

        uint256 currentDayGains;
        uint256 currentDayLosses;

        uint256 tomorrowOngoingTotals;
        uint256 yesterdayOngoingTotals;

        // aggregate all the unclaimed intra-days
        uint256 intraDayGains;
        uint256 intraDayLosses;
        uint256 intraDayRewardGains;
        uint256 intraDayRewardLosses;


        // how much each claim unit would get if they had staked from the dawn of time
        // expressed as fixed point number
        // claim amounts are expressed relative to this ongoing aggregate
        uint256 aggregateDailyRewardRateFP;
        uint256 yesterdayRewardRateFP;

        mapping(address => Claim) claims;
    }

    mapping(uint256 => TrancheMeta) public trancheMetadata;

    // last updated day
    uint256 public lastUpdatedDay;

    mapping(address => uint256) public accruedReward;

    /// Set share of tranche
    function setTrancheShare(uint256 tranche, uint256 share)
        external
        onlyOwner
    {
        require(
            trancheMetadata[tranche].rewardShare > 0,
            "Tranche is not initialized, please initialize first"
        );
        _setTrancheShare(tranche, share);
    }

    function _setTrancheShare(uint256 tranche, uint256 share) internal {
        TrancheMeta storage tm = trancheMetadata[tranche];

        if (share > tm.rewardShare) {
            trancheShareTotal += share - tm.rewardShare;
        } else {
            trancheShareTotal -= tm.rewardShare - share;
        }
        tm.rewardShare = share;
    }

    /// Initialize tranche
    function initTranche(uint256 tranche, uint256 share) external onlyOwner {
        TrancheMeta storage tm = trancheMetadata[tranche];
        require(tm.rewardShare == 0, "Tranche already initialized");
        _setTrancheShare(tranche, share);

        // simply initialize to 1.0
        tm.aggregateDailyRewardRateFP = FP32;
        allTranches.push(tranche);
    }

    /// Start / increase amount of claim
    function addToClaimAmount(
        uint256 tranche,
        address recipient,
        uint256 claimAmount
    ) external {
        require(
            isIncentiveReporter(msg.sender),
            "Contract not authorized to report incentives"
        );
        if (currentDailyDistribution > 0) {
            TrancheMeta storage tm = trancheMetadata[tranche];
            Claim storage claim = tm.claims[recipient];

            uint256 currentDay =
                claimAmount * (1 days - (block.timestamp % (1 days)));

            tm.currentDayGains += currentDay;
            claim.intraDayGain += currentDay * currentDailyDistribution;

            tm.tomorrowOngoingTotals += claimAmount * 1 days;
            updateAccruedReward(tm, recipient, claim);

            claim.amount += claimAmount * (1 days);
        }
    }

    /// Decrease amount of claim
    function subtractFromClaimAmount(
        uint256 tranche,
        address recipient,
        uint256 subtractAmount
    ) external {
        require(
            isIncentiveReporter(msg.sender),
            "Contract not authorized to report incentives"
        );
        uint256 currentDay = subtractAmount * (block.timestamp % (1 days));

        TrancheMeta storage tm = trancheMetadata[tranche];
        Claim storage claim = tm.claims[recipient];

        tm.currentDayLosses += currentDay;
        claim.intraDayLoss += currentDay * currentDailyDistribution;

        tm.tomorrowOngoingTotals -= subtractAmount * 1 days;

        updateAccruedReward(tm, recipient, claim);
        claim.amount -= subtractAmount * (1 days);
    }

    function updateAccruedReward(
        TrancheMeta storage tm,
        address recipient,
        Claim storage claim
                                 ) internal returns (uint256 rewardDelta){
        if (claim.startingRewardRateFP > 0) {
            rewardDelta = calcRewardAmount(tm, claim);
            accruedReward[recipient] += rewardDelta;
        }
        // don't reward for current day (approximately)
        claim.startingRewardRateFP =
            tm.yesterdayRewardRateFP +
            tm.aggregateDailyRewardRateFP;
    }

    /// @dev additional reward accrued since last update
    function calcRewardAmount(TrancheMeta storage tm, Claim storage claim)
        internal
        view
        returns (uint256 rewardAmount)
    {
        uint256 ours = claim.startingRewardRateFP;
        uint256 aggregate = tm.aggregateDailyRewardRateFP;
        if (aggregate > ours) {
            rewardAmount = (claim.amount * (aggregate - ours)) / FP32;
        }
    }

    function applyIntraDay(
                           TrancheMeta storage tm,
        Claim storage claim
                           ) internal view returns (uint256 gainImpact, uint256 lossImpact) {
        uint256 gain = claim.intraDayGain;
        uint256 loss = claim.intraDayLoss;

        if (gain + loss > 0) {
            gainImpact =
                (gain * tm.intraDayRewardGains) /
                    (tm.intraDayGains + 1);
            lossImpact =
                (loss * tm.intraDayRewardLosses) /
                    (tm.intraDayLosses + 1);
        }
    }

    /// Get a view of reward amount
    function viewRewardAmount(uint256 tranche, address claimant)
        external
        view
        returns (uint256)
    {
        TrancheMeta storage tm = trancheMetadata[tranche];
        Claim storage claim = tm.claims[claimant];

        uint256 rewardAmount =
            accruedReward[claimant] + calcRewardAmount(tm, claim);
        (uint256 gainImpact, uint256 lossImpact) = applyIntraDay(tm, claim);

        return rewardAmount + gainImpact - lossImpact;
    }

    /// Withdraw current reward amount
    function withdrawReward(uint256[] calldata tranches)
        external
        returns (uint256 withdrawAmount)
    {
        require(
            isIncentiveReporter(msg.sender),
            "Contract not authorized to report incentives"
        );

        updateDayTotals();

        withdrawAmount = accruedReward[msg.sender];
        for (uint256 i; tranches.length > i; i++) {
            uint256 tranche = tranches[i];

            TrancheMeta storage tm = trancheMetadata[tranche];
            Claim storage claim = tm.claims[msg.sender];

            withdrawAmount += updateAccruedReward(tm, msg.sender, claim);

            (uint256 gainImpact, uint256 lossImpact) = applyIntraDay(
                                                                     tm,
                claim
            );

            withdrawAmount = withdrawAmount + gainImpact - lossImpact;

            tm.intraDayGains -= claim.intraDayGain;
            tm.intraDayLosses -= claim.intraDayLoss;
            tm.intraDayRewardGains -= gainImpact;
            tm.intraDayRewardLosses -= lossImpact;
            
            claim.intraDayGain = 0;
        }

        accruedReward[msg.sender] = 0;

        Fund(fund()).withdraw(MFI, msg.sender, withdrawAmount);
    }

    function updateDayTotals() internal {
        uint256 nowDay = block.timestamp / (1 days);
        uint256 dayDiff = nowDay - lastUpdatedDay;

        // shrink the daily distribution for every day that has passed
        for (uint256 i = 0; i < dayDiff; i++) {
            _updateTrancheTotals();

            currentDailyDistribution =
                (currentDailyDistribution * contractionPerMil) /
                1000;

            lastUpdatedDay += 1;
        }
    }

    function _updateTrancheTotals() internal {
        for (uint256 i; allTranches.length > i; i++) {
            uint256 tranche = allTranches[i];
            TrancheMeta storage tm = trancheMetadata[tranche];

            uint256 todayTotal =
                tm.yesterdayOngoingTotals +
                    tm.currentDayGains -
                tm.currentDayLosses;

            uint256 todayRewardRateFP =
                (FP32 * (currentDailyDistribution * tm.rewardShare)) /
                    trancheShareTotal /
                    todayTotal;

            tm.yesterdayRewardRateFP = todayRewardRateFP;

            tm.aggregateDailyRewardRateFP += todayRewardRateFP;

            tm.intraDayGains +=
                tm.currentDayGains *
                currentDailyDistribution;

            tm.intraDayLosses +=
                tm.currentDayLosses *
                currentDailyDistribution;

            tm.intraDayRewardGains +=
                (tm.currentDayGains * todayRewardRateFP) /
                FP32;

            tm.intraDayRewardLosses +=
                (tm.currentDayLosses * todayRewardRateFP) /
                FP32;

            tm.yesterdayOngoingTotals = tm.tomorrowOngoingTotals;
            tm.currentDayGains = 0;
            tm.currentDayLosses = 0;
        }
    }
}
