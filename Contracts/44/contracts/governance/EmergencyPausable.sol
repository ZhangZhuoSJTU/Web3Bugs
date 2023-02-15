pragma solidity ^0.8.0;

import "./EmergencyGovernable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @dev Base for contracts with actions that should be emergency-pausable.
///      Implies Ownable, and assumes the owner is a
///      TimelockGovernorWithEmergencyGovernance. Includes `whenPaused` and
///      `whenNotPaused` modifiers which restrict a modified function
///      based on the whether `pause` has been called. The `pause` function
///      is restricted to timelocked or emergency governance.
contract EmergencyPausable is EmergencyGovernable, Pausable {
    /// @notice Pause all functions with the `whenNotPaused` modifier. Modified
    ///         functions will revert if called.
    /// @dev Only timelocked or emergency governance may call this function.
    function pause() external onlyTimelockOrEmergencyGovernance {
        super._pause();
    }

    /// @notice Unpause all functions with the `whenNotPaused` modifier. Modified
    ///         functions will no longer revert.
    /// @dev Only timelocked or emergency governance may call this function.
    function unpause() external onlyTimelockOrEmergencyGovernance {
        super._unpause();
    }
}
