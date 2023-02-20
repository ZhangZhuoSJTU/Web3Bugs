// SPDX-License-Identifier: MIT

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IBadgerTreeV2 {
    /// @dev Return true if account has outstanding claims in any token from the given input data
    function isClaimAvailableFor(
        address user,
        address[] memory tokens,
        uint256[] memory cumulativeAmounts
    ) external view;

    /// @dev Get the number of tokens claimable for an account, given a list of tokens and latest cumulativeAmounts data
    function getClaimableFor(
        address user,
        address[] memory tokens,
        uint256[] memory cumulativeAmounts
    ) external view;

    /// @dev Get the cumulative number of tokens claimed for an account, given a list of tokens
    function getClaimedFor(address user, address[] memory tokens) external view;

    /// @dev Utility function to encode a merkle tree node
    function encodeClaim(
        address[] calldata tokens,
        uint256[] calldata cumulativeAmounts,
        address account,
        uint256 index,
        uint256 cycle
    ) external pure;

    /// @notice Claim specifiedrewards for a set of tokens at a given cycle number
    /// @notice Can choose to skip certain tokens by setting amount to claim to zero for that token index
    function claim(
        address[] calldata tokens,
        uint256[] calldata cumulativeAmounts,
        uint256 index,
        uint256 cycle,
        bytes32[] calldata merkleProof,
        uint256[] calldata amountsToClaim
    ) external;

    // ===== Root Updater Restricted =====

    /// @notice Propose a new root and content hash, which will be stored as pending until approved
    function proposeRoot(
        bytes32 root,
        bytes32 contentHash,
        uint256 cycle,
        uint256 startBlock,
        uint256 endBlock
    ) external;

    /// ===== Guardian Restricted =====

    /// @notice Approve the current pending root and content hash
    function approveRoot(
        bytes32 root,
        bytes32 contentHash,
        uint256 cycle,
        uint256 startBlock,
        uint256 endBlock
    ) external;
}
