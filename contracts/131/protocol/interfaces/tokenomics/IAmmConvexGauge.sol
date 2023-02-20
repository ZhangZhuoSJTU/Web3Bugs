// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IAmmConvexGauge {
    function deactivateInflationRecipient() external;

    function setInflationRecipient(address recipient) external;

    function allClaimableRewards(address user) external view returns (uint256[3] memory);
}
