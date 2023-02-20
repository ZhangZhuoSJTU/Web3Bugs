// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IsolatedMarginAccounts.sol";

/** 
@title Handles liquidation of accounts below maintenance threshold
@notice Liquidation can be called by the authorized staker, 
as determined in the Admin contract.
If the authorized staker is delinquent, other participants can jump
in and attack, taking their fees and potentially even their stake,
depending how delinquent the responsible authorized staker is.
*/
abstract contract IsolatedMarginLiquidation is Ownable, IsolatedMarginAccounts {
    event LiquidationShortfall(uint256 amount);
    event AccountLiquidated(address account);

    /// record kept around until a stake attacker can claim their reward
    struct AccountLiqRecord {
        uint256 blockNum;
        address loser;
        uint256 amount;
        address stakeAttacker;
    }

    address[] internal tradersToLiquidate;

    mapping(address => uint256) public maintenanceFailures;
    mapping(address => AccountLiqRecord) public stakeAttackRecords;
    uint256 public avgLiquidationPerCall = 10;

    uint256 public liqStakeAttackWindow = 5;
    uint256 public MAINTAINER_CUT_PERCENT = 5;

    uint256 public failureThreshold = 10;

    /// Set failure threshold
    function setFailureThreshold(uint256 threshFactor) external onlyOwner {
        failureThreshold = threshFactor;
    }

    /// Set liquidity stake attack window
    function setLiqStakeAttackWindow(uint256 window) external onlyOwner {
        liqStakeAttackWindow = window;
    }

    /// Set maintainer's percent cut
    function setMaintainerCutPercent(uint256 cut) external onlyOwner {
        MAINTAINER_CUT_PERCENT = cut;
    }

    /// @dev calcLiquidationAmounts does a number of tasks in this contract
    /// and some of them are not straightforward.
    /// First of all it aggregates the total amount to sell
    /// as well as which traders are ripe for liquidation, in storage (not in memory)
    /// owing to the fact that arrays can't be pushed to and hash maps don't
    /// exist in memory.
    /// Then it also returns any stake attack funds if the stake was unsuccessful
    /// (i.e. current caller is authorized). Also see context below.
    function calcLiquidationAmounts(
        address[] memory liquidationCandidates,
        bool isAuthorized
    )
        internal
        returns (
            uint256 attackReturns,
            uint256 sellAmount,
            uint256 buyTarget
        )
    {
        tradersToLiquidate = new address[](0);

        for (
            uint256 traderIndex = 0;
            liquidationCandidates.length > traderIndex;
            traderIndex++
        ) {
            address traderAddress = liquidationCandidates[traderIndex];
            IsolatedMarginAccount storage account =
                marginAccounts[traderAddress];

            if (belowMaintenanceThreshold(account)) {
                tradersToLiquidate.push(traderAddress);

                sellAmount += account.holding;

                updateLoan(account);
                buyTarget += account.borrowed;

                // TODO pay off / extinguish that loan
            }

            AccountLiqRecord storage liqAttackRecord =
                stakeAttackRecords[traderAddress];
            if (isAuthorized) {
                attackReturns += _disburseLiqAttack(liqAttackRecord);
            }
        }
    }

    function _disburseLiqAttack(AccountLiqRecord storage liqAttackRecord)
        internal
        returns (uint256 returnAmount)
    {
        if (liqAttackRecord.amount > 0) {
            // validate attack records, if any
            uint256 blockDiff =
                min(
                    block.number - liqAttackRecord.blockNum,
                    liqStakeAttackWindow
                );

            uint256 attackerCut =
                (liqAttackRecord.amount * blockDiff) / liqStakeAttackWindow;

            Fund(fund()).withdraw(
                borrowToken,
                liqAttackRecord.stakeAttacker,
                attackerCut
            );

            Admin a = Admin(admin());
            uint256 penalty =
                (a.maintenanceStakePerBlock() * attackerCut) /
                    avgLiquidationPerCall;
            a.penalizeMaintenanceStake(
                liqAttackRecord.loser,
                penalty,
                liqAttackRecord.stakeAttacker
            );

            // return remainder, after cut was taken to authorized stakekr
            returnAmount = liqAttackRecord.amount - attackerCut;
        }
    }

    /// Disburse liquidity stake attacks
    function disburseLiqStakeAttacks(address[] memory liquidatedAccounts)
        external
    {
        for (uint256 i = 0; liquidatedAccounts.length > i; i++) {
            address liqAccount = liquidatedAccounts[i];
            AccountLiqRecord storage liqAttackRecord =
                stakeAttackRecords[liqAccount];
            if (
                block.number > liqAttackRecord.blockNum + liqStakeAttackWindow
            ) {
                _disburseLiqAttack(liqAttackRecord);
                delete stakeAttackRecords[liqAccount];
            }
        }
    }

    function maintainerIsFailing() internal view returns (bool) {
        (address currentMaintainer, ) =
            Admin(admin()).viewCurrentMaintenanceStaker();
        return
            maintenanceFailures[currentMaintainer] >
            failureThreshold * avgLiquidationPerCall;
    }

    function liquidateToBorrow(uint256 sellAmount) internal returns (uint256) {
        uint256[] memory amounts =
            MarginRouter(router()).authorizedSwapExactT4T(
                sellAmount,
                0,
                liquidationPairs,
                liquidationTokens
            );

        uint256 outAmount = amounts[amounts.length - 1];

        return outAmount;
    }

    /// called by maintenance stakers to liquidate accounts below liquidation threshold
    function liquidate(address[] memory liquidationCandidates)
        external
        noIntermediary
        returns (uint256 maintainerCut)
    {
        bool isAuthorized = Admin(admin()).isAuthorizedStaker(msg.sender);
        bool canTakeNow = isAuthorized || maintainerIsFailing();

        // calcLiquidationAmounts does a lot of the work here
        // * aggregates both sell and buy side targets to be liquidated
        // * returns attacker cuts to them
        // * aggregates any returned fees from unauthorized (attacking) attempts
        uint256 sellAmount;
        uint256 liquidationTarget;
        (maintainerCut, sellAmount, liquidationTarget) = calcLiquidationAmounts(
            liquidationCandidates,
            isAuthorized
        );

        uint256 liquidationReturns = liquidateToBorrow(sellAmount);

        // this may be a bit imprecise, since individual shortfalls may be obscured
        // by overall returns and the maintainer cut is taken out of the net total,
        // but it gives us the general picture
        liquidationTarget *= (100 + MAINTAINER_CUT_PERCENT) / 100;
        if (liquidationTarget > liquidationReturns) {
            emit LiquidationShortfall(liquidationTarget - liquidationReturns);

            Lending(lending()).haircut(liquidationTarget - liquidationReturns);
        }

        address loser = address(0);
        if (!canTakeNow) {
            // whoever is the current responsible maintenance staker
            // and liable to lose their stake
            loser = Admin(admin()).getUpdatedCurrentStaker();
        }

        // iterate over traders and send back their money
        // as well as giving attackers their due, in case caller isn't authorized
        for (
            uint256 traderIdx = 0;
            tradersToLiquidate.length > traderIdx;
            traderIdx++
        ) {
            address traderAddress = tradersToLiquidate[traderIdx];
            IsolatedMarginAccount storage account =
                marginAccounts[traderAddress];

            // 5% of value borrowed
            uint256 maintainerCut4Account =
                (account.borrowed * MAINTAINER_CUT_PERCENT) / 100;
            maintainerCut += maintainerCut4Account;

            if (!canTakeNow) {
                // This could theoretically lead to a previous attackers
                // record being overwritten, but only if the trader restarts
                // their account and goes back into the red within the short time window
                // which would be a costly attack requiring collusion without upside
                AccountLiqRecord storage liqAttackRecord =
                    stakeAttackRecords[traderAddress];
                liqAttackRecord.amount = maintainerCut4Account;
                liqAttackRecord.stakeAttacker = msg.sender;
                liqAttackRecord.blockNum = block.number;
                liqAttackRecord.loser = loser;
            }

            uint256 holdingsValue =
                (account.holding * liquidationReturns) / sellAmount;

            // send back trader money
            if (holdingsValue >= maintainerCut4Account + account.borrowed) {
                // send remaining funds back to trader
                Fund(fund()).withdraw(
                    borrowToken,
                    traderAddress,
                    holdingsValue - account.borrowed - maintainerCut4Account
                );
            }

            emit AccountLiquidated(traderAddress);
            delete marginAccounts[traderAddress];
        }

        avgLiquidationPerCall =
            (avgLiquidationPerCall * 99 + maintainerCut) /
            100;

        if (canTakeNow) {
            Fund(fund()).withdraw(borrowToken, msg.sender, maintainerCut);
        }

        address currentMaintainer = Admin(admin()).getUpdatedCurrentStaker();
        if (isAuthorized) {
            if (maintenanceFailures[currentMaintainer] > maintainerCut) {
                maintenanceFailures[currentMaintainer] -= maintainerCut;
            } else {
                maintenanceFailures[currentMaintainer] = 0;
            }
        } else {
            maintenanceFailures[currentMaintainer] += maintainerCut;
        }
    }
}
