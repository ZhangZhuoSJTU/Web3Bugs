pragma solidity ^0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract TestTokenBatchMiddleware is Ownable {
	using SafeERC20 for IERC20;

	function submitBatch(
		uint256[] memory _amounts,
		address[] memory _destinations,
		address _tokenContract
	) public onlyOwner {
		// Send transaction amounts to destinations
		for (uint256 i = 0; i < _amounts.length; i++) {
			IERC20(_tokenContract).safeTransfer(_destinations[i], _amounts[i]);
		}
	}
}
