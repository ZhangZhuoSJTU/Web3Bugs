pragma solidity ^0.6.6;

import "hardhat/console.sol";

contract SigningTest {
	function checkSignature(
		address _signer,
		bytes32 _theHash,
		uint8 _v,
		bytes32 _r,
		bytes32 _s
	) public view {
		bytes32 messageDigest = keccak256(abi.encode("\x19Ethereum Signed Message:\n32", _theHash));

		console.log("signer");
		console.logAddress(_signer);
		console.log("theHash");
		console.logBytes32(_theHash);
		console.log("v");
		console.logUint(_v);
		console.log("r");
		console.logBytes32(_r);
		console.log("s");
		console.logBytes32(_s);
		console.log("ecrecover");
		console.logAddress(ecrecover(messageDigest, _v, _r, _s));
		console.log("address");
		console.logAddress(_signer);

		require(_signer == ecrecover(messageDigest, _v, _r, _s), "Signature does not match.");
	}
}
