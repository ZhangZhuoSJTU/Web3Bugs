pragma solidity 0.6.12;

import "./IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint) external;
    function transfer(address, uint) external returns (bool);

}