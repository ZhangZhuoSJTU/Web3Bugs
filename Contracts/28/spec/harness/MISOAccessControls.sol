pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/*
 * Harness to simplify:
 *      1. contracts/Access/MISOAdminAccess.sol
 *      2. contracts/Access/MISOAccessControls.sol
 */
contract MISOAccessControls {
    bool initialized; 
    address admin;

    function initAccessControls(address _admin) public {
        require(!initialized);
        initialized = true;
        admin = _admin;
    }

    function isInitialized() public returns (bool) {
        return initialized;
    } 
    
    function hasAdminRole(address _address) public view returns (bool) {
        return admin == _address;
    }

    mapping (address => bool) hasRoleSMART_CONTRACT_ROLE;
    function hasSmartContractRole(address _address) public view returns (bool) {
        return hasRoleSMART_CONTRACT_ROLE[_address];
    }
}