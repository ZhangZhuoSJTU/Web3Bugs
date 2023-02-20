// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;
    
interface ILockupContractFactory {
    
    // --- Events ---

    event YETITokenAddressSet(address _yetiTokenAddress);
    event LockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint _unlockTime, address _deployer);

    // --- Functions ---

    function setYETITokenAddress(address _yetiTokenAddress) external;

    function deployLockupContract(address _beneficiary, uint _unlockTime) external;

    function isRegisteredLockup(address _addr) external view returns (bool);
}
