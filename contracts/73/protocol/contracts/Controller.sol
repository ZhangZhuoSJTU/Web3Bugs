pragma solidity ^0.5.11;

import "./IController.sol";
import "./IManager.sol";

import "./zeppelin/Pausable.sol";

contract Controller is Pausable, IController {
    // Track information about a registered contract
    struct ContractInfo {
        address contractAddress; // Address of contract
        bytes20 gitCommitHash; // SHA1 hash of head Git commit during registration of this contract
    }

    // Track contract ids and contract info
    mapping(bytes32 => ContractInfo) private registry;

    constructor() public {
        // Start system as paused
        paused = true;
    }

    /**
     * @notice Register contract id and mapped address
     * @param _id Contract id (keccak256 hash of contract name)
     * @param _contractAddress Contract address
     */
    function setContractInfo(
        bytes32 _id,
        address _contractAddress,
        bytes20 _gitCommitHash
    ) external onlyOwner {
        registry[_id].contractAddress = _contractAddress;
        registry[_id].gitCommitHash = _gitCommitHash;

        emit SetContractInfo(_id, _contractAddress, _gitCommitHash);
    }

    /**
     * @notice Update contract's controller
     * @param _id Contract id (keccak256 hash of contract name)
     * @param _controller Controller address
     */
    function updateController(bytes32 _id, address _controller) external onlyOwner {
        return IManager(registry[_id].contractAddress).setController(_controller);
    }

    /**
     * @notice Return contract info for a given contract id
     * @param _id Contract id (keccak256 hash of contract name)
     */
    function getContractInfo(bytes32 _id) public view returns (address, bytes20) {
        return (registry[_id].contractAddress, registry[_id].gitCommitHash);
    }

    /**
     * @notice Get contract address for an id
     * @param _id Contract id
     */
    function getContract(bytes32 _id) public view returns (address) {
        return registry[_id].contractAddress;
    }
}
