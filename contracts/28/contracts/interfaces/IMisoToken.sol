pragma solidity 0.6.12;

interface IMisoToken {
    function init(bytes calldata data) external payable;
    function initToken( bytes calldata data ) external;
    function tokenTemplate() external view returns (uint256);

}