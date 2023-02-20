// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "../ControllerV1.sol";

pragma experimental ABIEncoderV2;

contract UpgradeControllerV2 is ControllerV1 {
    int public version;

    function getName() external pure returns (string memory)  {
        return "ControllerUpgradeV2";
    }

    function setVersion() external {
        version = version + 1;
    }
}
