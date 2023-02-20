pragma solidity ^0.8.7;

import "./TestERC20Mock.sol";

contract MinterMock {
    constructor() {}

    function emergency_mint(address _tokenOut, uint256 _amountOut) external {
        TestERC20Mock(_tokenOut).mint(msg.sender, _amountOut);
    }
}
