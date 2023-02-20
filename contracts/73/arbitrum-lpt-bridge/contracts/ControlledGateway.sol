//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ControlledGateway
 * @notice Base Contract for both L1 and L2 LPT gateways. Provides AccessControl.
 * Gateways can be paused by the governor to stop outgoing token migrations
 */
contract ControlledGateway is AccessControl, Pausable {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    address public immutable l1Lpt;
    address public immutable l2Lpt;

    constructor(address _l1Lpt, address _l2Lpt) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(GOVERNOR_ROLE, DEFAULT_ADMIN_ROLE);

        l1Lpt = _l1Lpt;
        l2Lpt = _l2Lpt;
    }

    function pause() external onlyRole(GOVERNOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNOR_ROLE) {
        _unpause();
    }
}
