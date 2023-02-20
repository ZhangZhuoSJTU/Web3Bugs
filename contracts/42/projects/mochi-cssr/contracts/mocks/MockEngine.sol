// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IGovernanceOwned.sol";

contract MockOwned is IGovernanceOwned {
    address public override governance;

    constructor() {
        governance = msg.sender;
    }
}
