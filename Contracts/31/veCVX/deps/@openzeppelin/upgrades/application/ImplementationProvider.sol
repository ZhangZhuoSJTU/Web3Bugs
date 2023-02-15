pragma solidity ^0.5.0;

/**
 * @title ImplementationProvider
 * @dev Abstract contract for providing implementation addresses for other contracts by name.
 */
contract ImplementationProvider {
    /**
     * @dev Abstract function to return the implementation address of a contract.
     * @param contractName Name of the contract.
     * @return Implementation address of the contract.
     */
    function getImplementation(string memory contractName)
        public
        view
        returns (address);
}
