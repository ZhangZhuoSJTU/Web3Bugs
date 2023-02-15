// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.7;

/**
 * @notice The Access Controller is used for allowing/blocking access to
 * contract functions.
 */
interface IAccountAccessController {
    /**
     * @dev Emitted via `setRoot()`.
     * @param root The new merkle root
     */
    event RootChanged(bytes32 root);

    /**
     * @dev Emitted via `allowAccounts()` and `allowSelf`.
     * @param account The account that was allowed
     */
    event AccountAllowed(address indexed account);

    /**
     * @dev Emitted via `blockAccounts()`.
     * @param account The account that was blocked
     */
    event AccountBlocked(address indexed account);

    /**
     * @dev Emitted via `setRoot()` and `clearAllowedAccounts`,
     * and `setRootAndClearAllowedAccounts`.
     * @param index The index for the new allowlist
     */
    event AllowedAccountsCleared(uint32 index);

    /**
     * @dev Emitted via `clearBlockedAccounts`.
     * @param index The index for the new blocklist
     */
    event BlockedAccountsCleared(uint32 index);

    /**
     * @notice Sets the merkle root used to determine which accounts
     * to allow.
     * @dev Only callable by `owner()`.
     * @param newRoot The new merkle root
     */
    function setRoot(bytes32 newRoot) external;

    /**
     * @notice Clears the allowlist for all accounts.
     * @dev This does not actually modify any existing allowlists, the
     * the function will increment an index pointing to a new mapping
     * that will be referenced.
     *
     * Only callable by `owner()`.
     */
    function clearAllowedAccounts() external;

    /**
     * @notice Sets the merkle root used to determine which accounts
     * to allow and resets the allowlist.
     * @dev Only callable by `owner()`.
     * @param newRoot The new merkle root
     */
    function setRootAndClearAllowedAccounts(bytes32 newRoot) external;

    /**
     * @notice Clears the blocklist for all accounts.
     * @dev This does not actually modify any existing blocklists, the
     * the function will increment an index pointing to a new mapping
     * that will be referenced.
     *
     * Only callable by `owner()`.
     */
    function clearBlockedAccounts() external;

    /**
     * @notice Allows one or more accounts, regardless of existing access.
     * @dev Only callable by `owner()`.
     * @param accounts Accounts to allow
     */
    function allowAccounts(address[] calldata accounts) external;

    /**
     * @notice Blocks one or more accounts, regardless of existing access.
     * @dev Only callable by `owner()`.
     * @param accounts Accounts to block
     */
    function blockAccounts(address[] calldata accounts) external;

    /**
     * @notice Allows the caller if the provided signature is valid.
     * @dev An account cannot call this function if it is already
     * allowed/blocked.
     * @param proof Proof of the caller's inclusion in the merkle root
     */
    function allowSelf(bytes32[] calldata proof) external;

    /**
     * @notice Returns the merkle root used to determine which accounts
     * to allow.
     * @return The current merkle root
     */
    function getRoot() external view returns (bytes32);

    /**
     * @return Whether the account is allowed
     */
    function isAccountAllowed(address account) external view returns (bool);

    /**
     * @return Whether the account is blocked
     */
    function isAccountBlocked(address account) external view returns (bool);
}
