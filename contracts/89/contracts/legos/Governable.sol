// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VanillaGovernable {
    address public governance;

    modifier onlyGovernance() {
        require(msg.sender == governance, "ONLY_GOVERNANCE");
        _;
    }

    function setGovernace(address _governance) external onlyGovernance {
        _setGovernace(_governance);
    }

    function _setGovernace(address _governance) internal {
        governance = _governance;
    }
}

contract Governable is VanillaGovernable, Initializable {}
