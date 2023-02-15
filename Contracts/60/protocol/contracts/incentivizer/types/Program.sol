// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../../product/types/position/Position.sol";
import "../../utils/types/Token18.sol";
import "./ProgramInfo.sol";

struct Program {
    /// @dev Mapping of latest synced oracle version for each account
    mapping(address => uint256) latestVersion;

    /// @dev Mapping of latest rewards settled for each account
    mapping(address => UFixed18) settled;

    /// @dev Total amount of rewards yet to be claimed
    UFixed18 available;

    /// @dev Oracle version that the program completed, 0 is still ongoing
    uint256 versionComplete;

    /// @dev Whether the program is closed
    bool closed;

    /// @dev Whether the program is owned by the protocol (true) or by the product owner (false)
    bool protocolOwned;
}

library ProgramLib {
    using UFixed18Lib for UFixed18;
    using PositionLib for Position;
    using AccumulatorLib for Accumulator;
    using ProgramInfoLib for ProgramInfo;

    /**
     * @notice Initializes the program state
     * @param self Static The Program to operate on
     * @param programInfo Static program information
     * @param protocolOwned Whether the program is protocol owned
     */
    function initialize(Program storage self, ProgramInfo memory programInfo, bool protocolOwned) internal {
        self.available = programInfo.amount.sum();
        self.protocolOwned = protocolOwned;
    }

    /**
     * @notice Returns whether a program can be closed
     * @dev Programs must wait to be closed until after their grace period has concluded whether
     *      or not it was completed early
     * @param self Static The Program to operate on
     * @param programInfo Static program information
     * @param timestamp The effective timestamp to check
     * @return Whether the program can be closed
     */
    function canClose(Program storage self, ProgramInfo memory programInfo, uint256 timestamp) internal view returns (bool) {
        uint256 end = self.versionComplete == 0 ?
            programInfo.start + programInfo.duration :
            programInfo.product.provider().timestampAtVersion(self.versionComplete);
        return timestamp >= (end + programInfo.grace);
    }

    /**
     * @notice Closes the program
     * @param self Static The Program to operate on
     * @return amountToReturn Amount of remaining unclaimed reward tokens to be returned
     */
    function close(Program storage self) internal returns (UFixed18 amountToReturn) {
        amountToReturn = self.available;
        self.available = UFixed18Lib.ZERO;
        self.closed = true;
    }

    /**
     * @notice Completes the program
     * @dev Completion prevents anymore rewards from accruing, but users may still claim during the
     *      grace period until a program is closed
     * @param self Static The Program to operate on
     * @param oracleVersion The effective oracle version of completion
     */
    function complete(Program storage self, uint256 oracleVersion) internal {
        self.versionComplete = oracleVersion;
    }

    /**
     * @notice Settles unclaimed rewards for account `account`
     * @param self Static The Program to operate on
     * @param programInfo Static program information
     * @param account The account to settle for
     */
    function settle(Program storage self, ProgramInfo memory programInfo, address account) internal {
        (UFixed18 unsettledAmount, uint256 unsettledVersion) = unsettled(self, programInfo, account);

        self.settled[account] = self.settled[account].add(unsettledAmount);
        self.available = self.available.sub(unsettledAmount);
        self.latestVersion[account] = unsettledVersion;
    }

    /**
     * @notice Claims settled rewards for account `account`
     * @param self Static The Program to operate on
     * @param account The account to claim for
     */
    function claim(Program storage self, address account)
    internal returns (UFixed18 claimedAmount) {
        claimedAmount = self.settled[account];
        self.settled[account] = UFixed18Lib.ZERO;
    }

    /**
     * @notice Returns the total amount of unclaimed rewards for account `account`
     * @dev This includes both settled and unsettled unclaimed rewards
     * @param self Static The Program to operate on
     * @param programInfo Static program information
     * @param account The account to claim for
     * @return Total amount of unclaimed rewards for account
     */
    function unclaimed(Program storage self, ProgramInfo memory programInfo, address account)
    internal view returns (UFixed18) {
        (UFixed18 unsettledAmount, ) = unsettled(self, programInfo, account);
        return unsettledAmount.add(self.settled[account]);
    }

    /**
     * @notice Returns the unsettled amount of unclaimed rewards for account `account`
     * @dev Clears when a program is closed
     *      Assumes that position is unchanged since last settlement, must be settled prior to user position update
     * @param self Static The Program to operate on
     * @param programInfo Static program information
     * @param account The account to claim for
     * @return amount Amount of unsettled rewards for account
     * @return latestVersion Effective oracle version for computation
     */
    function unsettled(Program storage self, ProgramInfo memory programInfo, address account)
    private view returns (UFixed18 amount, uint256 latestVersion) {
        IProduct product = programInfo.product;

        uint256 userLatestVersion = self.latestVersion[account];
        Position memory userPosition = product.position(account);
        uint256 userSyncedTo = product.latestVersion(account);

        // compute version to sync to
        latestVersion = self.versionComplete == 0 ? userSyncedTo : Math.min(userSyncedTo, self.versionComplete);
        uint256 latestTimestamp = product.provider().timestampAtVersion(latestVersion);

        // check initialization conditions
        if (!programInfo.isStarted(latestTimestamp)) return (UFixed18Lib.ZERO, 0); // program hasn't started
        if (self.closed) return (UFixed18Lib.ZERO, latestVersion);                 // program has closed
        if (userLatestVersion == 0) return (UFixed18Lib.ZERO, latestVersion);      // user has not been initialized

        // compute unsettled amount
        Accumulator memory userShareDelta =
            userPosition.mul(product.shareAtVersion(latestVersion).sub(product.shareAtVersion(userLatestVersion)));
        amount = UFixed18Lib.from(programInfo.amountPerShare().mul(userShareDelta).sum());
    }
}
