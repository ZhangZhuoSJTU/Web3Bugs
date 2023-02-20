pragma solidity ^0.6.6;

import "hardhat/console.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract TestLogicContract is Ownable {
	address state_tokenContract;

	constructor(address _tokenContract) public {
		state_tokenContract = _tokenContract;
	}

	function transferTokens(
		address _to,
		uint256 _a,
		uint256 _b
	) public onlyOwner {
		IERC20(state_tokenContract).transfer(_to, _a + _b);
		console.log("Sent Tokens");
	}
}
