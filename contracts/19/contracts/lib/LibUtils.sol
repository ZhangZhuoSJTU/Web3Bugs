// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/// @title LibUtils
/// @author Connext <support@connext.network>
/// @notice Contains a helper to revert if a call was not successfully
///         made
library LibUtils {
    /// @notice If success is false, reverts and passes on the revert string.
    function revertIfCallFailed(bool success, bytes memory returnData)
        internal
        pure
    {
        if (!success) {
            assembly {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
    }
}
