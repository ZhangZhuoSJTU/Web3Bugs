//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC20 {
    function mintFor(address, uint) external;
}

contract Faucet {

    IERC20 public immutable usd;
    mapping(address => bool) public used;
    
    constructor(address _usd) {
        usd = IERC20(_usd);
    }

    function faucet() external {
        require(!used[msg.sender], "Already used faucet");
        require(msg.sender == tx.origin, "Is Contract");
        usd.mintFor(msg.sender, 10000e18);
        used[msg.sender] = true;
    }
}