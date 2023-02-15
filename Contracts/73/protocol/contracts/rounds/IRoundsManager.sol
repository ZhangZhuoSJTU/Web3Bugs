pragma solidity ^0.5.11;

/**
 * @title RoundsManager interface
 */
contract IRoundsManager {
    // Events
    event NewRound(uint256 indexed round, bytes32 blockHash);

    // Deprecated events
    // These event signatures can be used to construct the appropriate topic hashes to filter for past logs corresponding
    // to these deprecated events.
    // event NewRound(uint256 round)

    // External functions
    function initializeRound() external;

    function lipUpgradeRound(uint256 _lip) external view returns (uint256);

    // Public functions
    function blockNum() public view returns (uint256);

    function blockHash(uint256 _block) public view returns (bytes32);

    function blockHashForRound(uint256 _round) public view returns (bytes32);

    function currentRound() public view returns (uint256);

    function currentRoundStartBlock() public view returns (uint256);

    function currentRoundInitialized() public view returns (bool);

    function currentRoundLocked() public view returns (bool);
}
