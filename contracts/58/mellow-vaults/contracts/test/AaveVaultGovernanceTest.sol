// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "../interfaces/IAaveVaultGovernance.sol";
import "../AaveVaultGovernance.sol";
import "../VaultGovernance.sol";

contract AaveVaultGovernanceTest is AaveVaultGovernance {
    constructor(InternalParams memory internalParams_, DelayedProtocolParams memory delayedProtocolParams_)
        AaveVaultGovernance(internalParams_, delayedProtocolParams_)
    {
        delete _delayedProtocolParams;
    }
}
