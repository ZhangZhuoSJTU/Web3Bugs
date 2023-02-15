pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Base for contracts with actions that should be emergency-governable.
///      Implies Ownable, and assumes the owner is a
///      TimelockGovernorWithEmergencyGovernance. Provides the
///      onlyTimelockOrEmergencyGovernance modifier, which allows the system
///      governor's timelock OR the system governor's emergency governance
///      address to make a change.
contract EmergencyGovernable is Ownable {
    /// @dev Casts the owner to the expected
    ///      TimelockGovernorWithEmergencyGovernance interface.
    function governor()
        internal
        view
        returns (TimelockGovernorWithEmergencyGovernance)
    {
        return TimelockGovernorWithEmergencyGovernance(owner());
    }

    /// @dev Assumes this contract's owner is a governor implementing
    ///      TimelockGovernorWithEmergencyGovernance, and only allows
    ///      the modified function to be invoked from that governor's
    ///      timelock.
    ///
    ///      Note that applying this modifier means that transferring ownership
    ///      to a contract or EOA that does _not_ implement the
    ///      TimelockGovernorWithEmergencyGovernance interface will prevent
    ///      the modified function from being called. The governor is _not_
    ///      permitted to call the modified function directly.
    modifier onlyTimelock {
        require(
            msg.sender == governor().timelock(),
            "Only governor may call this function."
        );
        _;
    }

    /// @dev Assumes this contract's owner is a governor implementing
    ///      TimelockGovernorWithEmergencyGovernance, and only allows
    ///      the modified function to be invoked from either that governor's
    ///      timelock or its emergency governance address.
    ///
    ///      Note that applying this modifier means that transferring ownership
    ///      to a contract or EOA that does _not_ implement the
    ///      TimelockGovernorWithEmergencyGovernance interface will prevent
    ///      the modified function from being called. The governor is _not_
    ///      permitted to call the modified function directly.
    modifier onlyTimelockOrEmergencyGovernance {
        require(
            msg.sender == governor().emergencyGovernance() ||
                msg.sender == governor().timelock(),
            "Only emergency governor or governor may call this function."
        );
        _;
    }
}

interface TimelockGovernorWithEmergencyGovernance {
    function timelock() external returns (address);

    function emergencyGovernance() external returns (address);
}
