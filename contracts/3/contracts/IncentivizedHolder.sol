// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IncentiveDistribution.sol";
import "./RoleAware.sol";

/// @title helper class to facilitate staking and unstaking
/// within the incentive system.
abstract contract IncentivizedHolder is RoleAware {
    /// @dev here we cache incentive tranches to save on a bit of gas
    mapping(address => uint256) public incentiveTranches;

    /// Set incentive tranche
    function setIncentiveTranche(address token, uint256 tranche) external {
        require(
            isTokenActivator(msg.sender),
            "Caller not authorized to set incentive tranche"
        );
        incentiveTranches[token] = tranche;
    }

    function stakeClaim(
        address claimant,
        address token,
        uint256 amount
    ) internal {
        IncentiveDistribution iD =
            IncentiveDistribution(incentiveDistributor());

        uint256 tranche = incentiveTranches[token];

        iD.addToClaimAmount(tranche, claimant, amount);
    }

    function withdrawClaim(
        address claimant,
        address token,
        uint256 amount
    ) internal {
        uint256 tranche = incentiveTranches[token];

        IncentiveDistribution(incentiveDistributor()).subtractFromClaimAmount(
            tranche,
            claimant,
            amount
        );
    }
}
