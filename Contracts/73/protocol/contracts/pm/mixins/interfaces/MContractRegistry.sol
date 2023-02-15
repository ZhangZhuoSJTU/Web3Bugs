pragma solidity ^0.5.11;

import "../../../bonding/IBondingManager.sol";
import "../../../token/IMinter.sol";
import "../../../rounds/IRoundsManager.sol";

contract MContractRegistry {
    /**
     * @notice Checks if the system is paused
     * @dev Executes the 'whenSystemNotPaused' modifier 'MixinContractRegistry' inherits from 'Manager.sol'
     */
    modifier whenSystemNotPaused() {
        _;
    }

    /**
     * @notice Checks if the current round has been initialized
     * @dev Executes the 'currentRoundInitialized' modifier in 'MixinContractRegistry'
     */
    modifier currentRoundInitialized() {
        _;
    }

    /**
     * @dev Returns an instance of the IBondingManager interface
     */
    function bondingManager() internal view returns (IBondingManager);

    /**
     * @dev Returns an instance of the IMinter interface
     */
    function minter() internal view returns (IMinter);

    /**
     * @dev Returns an instance of the IRoundsManager interface
     */
    function roundsManager() internal view returns (IRoundsManager);
}
