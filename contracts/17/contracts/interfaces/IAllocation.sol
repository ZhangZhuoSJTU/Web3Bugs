// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../common/StructDefinitions.sol";

interface IAllocation {
    function calcSystemTargetDelta(SystemState calldata sysState, ExposureState calldata expState)
        external
        view
        returns (AllocationState memory allState);

    function calcVaultTargetDelta(SystemState calldata sysState, bool onlySwapOut)
        external
        view
        returns (StablecoinAllocationState memory stableState);

    function calcStrategyPercent(uint256 utilisationRatio) external pure returns (uint256[] memory);
}
