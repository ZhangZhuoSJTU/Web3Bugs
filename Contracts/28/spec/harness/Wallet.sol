pragma solidity 0.6.12;

contract Wallet {
    fallback() external payable { }

    function sendTo() external payable returns (bool) { return true; }

    receive() external payable { }
}