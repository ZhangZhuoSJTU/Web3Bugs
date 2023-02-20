pragma solidity 0.8.7;

import "./ERC20.sol";

contract ERC20Mock is ERC20 {
    string public name = "USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    constructor(address _address) {
        _mint(_address, 1e20);
    }

    mapping(address => bool) public minted;

    function mint() public {
        require(minted[msg.sender] == false);
        minted[msg.sender] = true;
        _mint(msg.sender, 1e10);
    }
}
