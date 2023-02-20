pragma solidity ^0.5.11;

import "../../ManagerProxyTarget.sol";
import "./interfaces/MContractRegistry.sol";

contract MixinContractRegistry is MContractRegistry, ManagerProxyTarget {
    /**
     * @dev Checks if the current round has been initialized
     */
    modifier currentRoundInitialized() {
        require(roundsManager().currentRoundInitialized(), "current round is not initialized");
        _;
    }

    constructor(address _controller) internal Manager(_controller) {}

    /**
     * @dev Returns an instance of the IBondingManager interface
     */
    function bondingManager() internal view returns (IBondingManager) {
        return IBondingManager(controller.getContract(keccak256("BondingManager")));
    }

    /**
     * @dev Returns an instance of the IMinter interface
     */
    function minter() internal view returns (IMinter) {
        return IMinter(controller.getContract(keccak256("Minter")));
    }

    /**
     * @dev Returns an instance of the IRoundsManager interface
     */
    function roundsManager() internal view returns (IRoundsManager) {
        return IRoundsManager(controller.getContract(keccak256("RoundsManager")));
    }
}
