// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "../interfaces/IUniV3VaultGovernance.sol";
import "../UniV3VaultGovernance.sol";
import "../VaultGovernance.sol";

contract UniV3VaultGovernanceTest is UniV3VaultGovernance {
    constructor(InternalParams memory internalParams_, DelayedProtocolParams memory delayedProtocolParams_)
        UniV3VaultGovernance(internalParams_, delayedProtocolParams_)
    {
        delete _delayedProtocolParams;
    }
}
