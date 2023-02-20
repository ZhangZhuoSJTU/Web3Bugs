pragma solidity 0.6.12;

interface IBentoBoxFactory {
    function deploy(address masterContract, bytes calldata data, bool useCreate2) external payable returns (address cloneAddress) ;
    function masterContractApproved(address, address) external view returns (bool);
    function masterContractOf(address) external view returns (address);
    function setMasterContractApproval(address user, address masterContract, bool approved, uint8 v, bytes32 r, bytes32 s) external;
}