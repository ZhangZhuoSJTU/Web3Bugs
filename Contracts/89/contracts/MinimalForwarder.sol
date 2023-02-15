// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { MinimalForwarder as Forwarder } from "@openzeppelin/contracts/metatx/MinimalForwarder.sol";
// import { MinimalForwarderUpgradeable } from "@openzeppelin/contracts-upgradeable/metatx/MinimalForwarderUpgradeable.sol";

contract MinimalForwarder is Forwarder {

    function executeRequiringSuccess(ForwardRequest calldata req, bytes calldata signature)
        external
        payable
    {
        (bool success, bytes memory returnData) = execute(req, signature);
        require(success, string(abi.encodePacked("META_EXEC_FAILED: ", returnData)));
    }
}
