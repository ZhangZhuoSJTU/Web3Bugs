pragma solidity ^0.8.0;

import "solmate/tokens/ERC20.sol";

contract TestToken is ERC20 {

	constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) 
    	ERC20(_name, _symbol, _decimals) 
    	public
    {

    }
}