// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPowerSwitch {
    /* admin events */

    event PowerOn();
    event PowerOff();
    event EmergencyShutdown();

    /* data types */

    enum State {Online, Offline, Shutdown}

    /* admin functions */

    function powerOn() external;

    function powerOff() external;

    function emergencyShutdown() external;

    /* view functions */

    function isOnline() external view returns (bool status);

    function isOffline() external view returns (bool status);

    function isShutdown() external view returns (bool status);

    function getStatus() external view returns (State status);

    function getPowerController() external view returns (address controller);
}

/// @title PowerSwitch
/// @notice Standalone pausing and emergency stop functionality
contract PowerSwitch is IPowerSwitch, Ownable {
    /* storage */

    IPowerSwitch.State private _status;

    /* initializer */

    constructor(address owner) {
        // sanity check owner
        require(owner != address(0), "PowerSwitch: invalid owner");
        // transfer ownership
        Ownable.transferOwnership(owner);
    }

    /* admin functions */

    /// @notice Turn Power On
    /// access control: only admin
    /// state machine: only when offline
    /// state scope: only modify _status
    /// token transfer: none
    function powerOn() external override onlyOwner {
        require(_status == IPowerSwitch.State.Offline, "PowerSwitch: cannot power on");
        _status = IPowerSwitch.State.Online;
        emit PowerOn();
    }

    /// @notice Turn Power Off
    /// access control: only admin
    /// state machine: only when online
    /// state scope: only modify _status
    /// token transfer: none
    function powerOff() external override onlyOwner {
        require(_status == IPowerSwitch.State.Online, "PowerSwitch: cannot power off");
        _status = IPowerSwitch.State.Offline;
        emit PowerOff();
    }

    /// @notice Shutdown Permanently
    /// access control: only admin
    /// state machine:
    /// - when online or offline
    /// - can only be called once
    /// state scope: only modify _status
    /// token transfer: none
    function emergencyShutdown() external override onlyOwner {
        require(_status != IPowerSwitch.State.Shutdown, "PowerSwitch: cannot shutdown");
        _status = IPowerSwitch.State.Shutdown;
        emit EmergencyShutdown();
    }

    /* getter functions */

    function isOnline() external view override returns (bool status) {
        return _status == State.Online;
    }

    function isOffline() external view override returns (bool status) {
        return _status == State.Offline;
    }

    function isShutdown() external view override returns (bool status) {
        return _status == State.Shutdown;
    }

    function getStatus() external view override returns (IPowerSwitch.State status) {
        return _status;
    }

    function getPowerController() external view override returns (address controller) {
        return Ownable.owner();
    }
}
