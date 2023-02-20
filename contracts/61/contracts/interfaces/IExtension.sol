// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IExtension {
    /**
     * @notice emitted when the Voting Pass Ratio parameter for Pools is updated
     * @param votingPassRatio the new value of the voting pass threshold for  Pools
     */
    event VotingPassRatioUpdated(uint256 votingPassRatio);

    /**
     * @notice emitted when the pool factory is updated in extension
     * @param poolFactory updated address of pool factory
     */
    event PoolFactoryUpdated(address indexed poolFactory);

    /**
     * @notice emitted when an extension is requested by a borrower for Pools
     * @param extensionVoteEndTime the value of the vote end time for the requested extension
     */
    event ExtensionRequested(uint256 extensionVoteEndTime);

    /**
     * @notice emitted when the requested extension for Pools is approved
     * @param poolID the address of the pool for which extension passed
     */
    event ExtensionPassed(address poolID);

    /**
     * @notice emitted when the lender for Pools has voted on extension request
     * @param lender address of the lender who voted
     * @param totalExtensionSupport the value of the total extension support for the Pools
     * @param lastVoteTime the last time the lender has voted on an extension request
     */
    event LenderVoted(address indexed lender, uint256 totalExtensionSupport, uint256 lastVoteTime);

    function initializePoolExtension(uint256 _repaymentInterval) external;

    function closePoolExtension() external;

    function removeVotes(
        address _from,
        address _to,
        uint256 _amount
    ) external;
}
