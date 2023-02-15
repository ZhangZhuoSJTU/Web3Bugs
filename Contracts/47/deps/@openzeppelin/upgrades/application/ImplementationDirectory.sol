pragma solidity ^0.5.0;

import "./ImplementationProvider.sol";
import "../ownership/Ownable.sol";
import '../utils/Address.sol';

/**
 * @title ImplementationDirectory
 * @dev Implementation provider that stores contract implementations in a mapping.
 */
contract ImplementationDirectory is ImplementationProvider, OpenZeppelinUpgradesOwnable {
  /**
   * @dev Emitted when the implementation of a contract is changed.
   * @param contractName Name of the contract.
   * @param implementation Address of the added implementation.
   */
  event ImplementationChanged(string contractName, address indexed implementation);

  /**
   * @dev Emitted when the implementation directory is frozen.
   */
  event Frozen();

  /// @dev Mapping where the addresses of the implementations are stored.
  mapping (string => address) internal implementations;

  /// @dev Mutability state of the directory.
  bool public frozen;

  /**
   * @dev Modifier that allows functions to be called only before the contract is frozen.
   */
  modifier whenNotFrozen() {
    require(!frozen, "Cannot perform action for a frozen implementation directory");
    _;
  }

  /**
   * @dev Makes the directory irreversibly immutable.
   * It can only be called once, by the owner.
   */
  function freeze() onlyOwner whenNotFrozen public {
    frozen = true;
    emit Frozen();
  }

  /**
   * @dev Returns the implementation address of a contract.
   * @param contractName Name of the contract.
   * @return Address of the implementation.
   */
  function getImplementation(string memory contractName) public view returns (address) {
    return implementations[contractName];
  }

  /**
   * @dev Sets the address of the implementation of a contract in the directory.
   * @param contractName Name of the contract.
   * @param implementation Address of the implementation.
   */
  function setImplementation(string memory contractName, address implementation) public onlyOwner whenNotFrozen {
    require(OpenZeppelinUpgradesAddress.isContract(implementation), "Cannot set implementation in directory with a non-contract address");
    implementations[contractName] = implementation;
    emit ImplementationChanged(contractName, implementation);
  }

  /**
   * @dev Removes the address of a contract implementation from the directory.
   * @param contractName Name of the contract.
   */
  function unsetImplementation(string memory contractName) public onlyOwner whenNotFrozen {
    implementations[contractName] = address(0);
    emit ImplementationChanged(contractName, address(0));
  }
}
