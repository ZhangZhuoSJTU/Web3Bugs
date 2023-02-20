// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity =0.8.9;

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/external/chainlink/IAggregator.sol";

contract GasThrottle is ProtocolConstants {
    bool public gasThrottleEnabled = true;

    modifier validateGas() {
        // TODO: Uncomment prior to launch
        // require(
        //     gasThrottleEnabled &&
        //         (block.basefee <= tx.gasprice &&
        //             tx.gasprice <=
        //             uint256(IAggregator(_FAST_GAS_ORACLE).latestAnswer())),
        //     "GasThrottle::validateGas: Gas Exceeds Thresholds"
        // );
        _;
    }
}
