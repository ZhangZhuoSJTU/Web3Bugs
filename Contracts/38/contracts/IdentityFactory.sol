// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "./Identity.sol";
import "./interfaces/IERC20.sol";

contract IdentityFactory {
	event LogDeployed(address addr, uint256 salt);

	address public creator;
	constructor() {
		creator = msg.sender;
	}

	function deploy(bytes calldata code, uint256 salt) external {
		deploySafe(code, salt);
	}

	// When the relayer needs to act upon an /identity/:addr/submit call, it'll either call execute on the Identity directly
	// if it's already deployed, or call `deployAndExecute` if the account is still counterfactual
	// we can't have deployAndExecuteBySender, because the sender will be the factory
	function deployAndExecute(
		bytes calldata code, uint256 salt,
		Identity.Transaction[] calldata txns, bytes calldata signature
	) external {
		address payable addr = payable(deploySafe(code, salt));
		Identity(addr).execute(txns, signature);
	}
	// but for the quick accounts we need this
	function deployAndCall(bytes calldata code, uint256 salt, address callee, bytes calldata data) external {
		deploySafe(code, salt);
		require(data.length > 4, 'DATA_LEN');
		bytes4 method;
		// solium-disable-next-line security/no-inline-assembly
		assembly {
			// can also do shl(224, shr(224, calldataload(0)))
			method := and(calldataload(data.offset), 0xffffffff00000000000000000000000000000000000000000000000000000000)
		}
		require(
			method == 0x6171d1c9 // execute((address,uint256,bytes)[],bytes)
			|| method == 0x534255ff // send(address,(uint256,address,address),(bool,bytes,bytes),(address,uint256,bytes)[])
			|| method == 0xf9338537 // sendTransfer(address,(uint256,address,address),bytes,bytes,(address,address,uint256,uint256))
			|| method == 0xa9f5353d // sendTxns(address,(uint256,address,address),bytes,bytes,(string,address,uint256,bytes)[])
		, 'INVALID_METHOD');
		(bool success, bytes memory errData) = callee.call(data);
		if (!success) revert(string(errData));
	}


	// Withdraw the earnings from various fees (deploy fees and execute fees earned cause of `deployAndExecute`)
	// although we do not use this since we no longer receive fees on the factory, it's good to have this for safety
	function withdraw(IERC20 token, address to, uint256 tokenAmount) public {
		require(msg.sender == creator, 'ONLY_CREATOR');
		token.transfer(to, tokenAmount);
	}

	// This is done to mitigate possible frontruns where, for example, deploying the same code/salt via deploy()
	// would make a pending deployAndExecute fail
	// The way we mitigate that is by checking if the contract is already deployed and if so, we continue execution
	function deploySafe(bytes memory code, uint256 salt) internal returns (address) {
		address expectedAddr = address(uint160(uint256(
			keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(code)))
		)));
		uint size;
		assembly { size := extcodesize(expectedAddr) }
		// If there is code at that address, we can assume it's the one we were about to deploy,
		// because of how CREATE2 and keccak256 works
		if (size == 0) {
			address addr;
			assembly { addr := create2(0, add(code, 0x20), mload(code), salt) }
			require(addr != address(0), 'FAILED_DEPLOYING');
			require(addr == expectedAddr, 'FAILED_MATCH');
			emit LogDeployed(addr, salt);
		}
		return expectedAddr;
	}
}
