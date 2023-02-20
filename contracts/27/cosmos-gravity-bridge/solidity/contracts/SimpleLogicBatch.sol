pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "hardhat/console.sol";


// This middleware allows arbitrary logic batches, executed by a single
// logic contract taking a single token.
// It would be trivial to pass an array of multiple token contracts and
// an array of multiple logic contracts, but we are not doing it here to
// save gas.
contract SimpleLogicBatchMiddleware is Ownable {
	using SafeERC20 for IERC20;

	event LogicCallEvent(
		address _logicContract,
		address _tokenContract,
		bool _success,
		bytes _returnData
	);

	function logicBatch(
		uint256[] memory _amounts,
		bytes[] memory _payloads,
		address _logicContract,
		address _tokenContract
	) public onlyOwner {
		// Send transaction amounts to destinations
		console.log("number of _amounts:%s", _amounts.length);
		for (uint256 i = 0; i < _amounts.length; i++) {
			console.log("Transfering %s",_amounts[i]);

			IERC20(_tokenContract).safeTransfer(_logicContract, _amounts[i]);
            bytes memory returnData= Address.functionCall(_logicContract,_payloads[i]);
			emit LogicCallEvent(_tokenContract, _logicContract, true, returnData);
		}
	}
}
