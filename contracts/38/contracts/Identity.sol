// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.7;

import "./libs/SignatureValidatorV2.sol";

contract Identity {
	mapping (address => bytes32) public privileges;
	// The next allowed nonce
	uint public nonce = 0;

	// Events
	event LogPrivilegeChanged(address indexed addr, bytes32 priv);
	event LogErr(address indexed to, uint value, bytes data, bytes returnData); // only used in tryCatch

	// Transaction structure
	// we handle replay protection separately by requiring (address(this), chainID, nonce) as part of the sig
	struct Transaction {
		address to;
		uint value;
		bytes data;
	}

	constructor(address[] memory addrs) {
		uint len = addrs.length;
		for (uint i=0; i<len; i++) {
			// @TODO should we allow setting to any arb value here?
			privileges[addrs[i]] = bytes32(uint(1));
			emit LogPrivilegeChanged(addrs[i], bytes32(uint(1)));
		}
	}

	// This contract can accept ETH without calldata
	receive() external payable {}

	// This contract can accept ETH with calldata
	// However, to support EIP 721 and EIP 1155, we need to respond to those methods with their own method signature
	fallback() external payable {
		bytes4 method = msg.sig;
		if (
			method == 0x150b7a02 // bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
				|| method == 0xf23a6e61 // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
				|| method == 0xbc197c81 // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
		) {
			// Copy back the method
			// solhint-disable-next-line no-inline-assembly
			assembly {
				calldatacopy(0, 0, 0x04)
				return (0, 0x20)
			}
		}
	}

	function setAddrPrivilege(address addr, bytes32 priv)
		external
	{
		require(msg.sender == address(this), 'ONLY_IDENTITY_CAN_CALL');
		// Anti-bricking measure: if the privileges slot is used for special data (not 0x01),
		// don't allow to set it to true
		if (privileges[addr] != bytes32(0) && privileges[addr] != bytes32(uint(1)))
			require(priv != bytes32(uint(1)), 'UNSETTING_SPECIAL_DATA');
		privileges[addr] = priv;
		emit LogPrivilegeChanged(addr, priv);
	}

	function tipMiner(uint amount)
		external
	{
		require(msg.sender == address(this), 'ONLY_IDENTITY_CAN_CALL');
		// See https://docs.flashbots.net/flashbots-auction/searchers/advanced/coinbase-payment/#managing-payments-to-coinbaseaddress-when-it-is-a-contract
		// generally this contract is reentrancy proof cause of the nonce
		executeCall(block.coinbase, amount, new bytes(0));
	}

	function tryCatch(address to, uint value, bytes calldata data)
		external
	{
		require(msg.sender == address(this), 'ONLY_IDENTITY_CAN_CALL');
		(bool success, bytes memory returnData) = to.call{value: value, gas: gasleft()}(data);
		if (!success) emit LogErr(to, value, data, returnData);
	}


	// WARNING: if the signature of this is changed, we have to change IdentityFactory
	function execute(Transaction[] calldata txns, bytes calldata signature)
		external
	{
		require(txns.length > 0, 'MUST_PASS_TX');
		// If we use the naive abi.encode(txn) and have a field of type `bytes`,
		// there is a discrepancy between ethereumjs-abi and solidity
		// @TODO check if this is resolved
		uint currentNonce = nonce;
		// NOTE: abi.encode is safer than abi.encodePacked in terms of collision safety
		bytes32 hash = keccak256(abi.encode(address(this), block.chainid, currentNonce, txns));
		// We have to increment before execution cause it protects from reentrancies
		nonce = currentNonce + 1;

		address signer = SignatureValidator.recoverAddrImpl(hash, signature, true);
		require(privileges[signer] != bytes32(0), 'INSUFFICIENT_PRIVILEGE');
		uint len = txns.length;
		for (uint i=0; i<len; i++) {
			Transaction memory txn = txns[i];
			executeCall(txn.to, txn.value, txn.data);
		}
		// The actual anti-bricking mechanism - do not allow a signer to drop their own priviledges
		require(privileges[signer] != bytes32(0), 'PRIVILEGE_NOT_DOWNGRADED');
	}

	// no need for nonce management here cause we're not dealing with sigs
	function executeBySender(Transaction[] calldata txns) external {
		require(txns.length > 0, 'MUST_PASS_TX');
		require(privileges[msg.sender] != bytes32(0), 'INSUFFICIENT_PRIVILEGE');
		uint len = txns.length;
		for (uint i=0; i<len; i++) {
			Transaction memory txn = txns[i];
			executeCall(txn.to, txn.value, txn.data);
		}
		// again, anti-bricking
		require(privileges[msg.sender] != bytes32(0), 'PRIVILEGE_NOT_DOWNGRADED');
	}

	// we shouldn't use address.call(), cause: https://github.com/ethereum/solidity/issues/2884
	// copied from https://github.com/uport-project/uport-identity/blob/develop/contracts/Proxy.sol
	// there's also
	// https://github.com/gnosis/MultiSigWallet/commit/e1b25e8632ca28e9e9e09c81bd20bf33fdb405ce
	// https://github.com/austintgriffith/bouncer-proxy/blob/master/BouncerProxy/BouncerProxy.sol
	// https://github.com/gnosis/safe-contracts/blob/7e2eeb3328bb2ae85c36bc11ea6afc14baeb663c/contracts/base/Executor.sol
	function executeCall(address to, uint256 value, bytes memory data)
		internal
	{
		assembly {
			let result := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)

			switch result case 0 {
				let size := returndatasize()
				let ptr := mload(0x40)
				returndatacopy(ptr, 0, size)
				revert(ptr, size)
			}
			default {}
		}
		// A single call consumes around 477 more gas with the pure solidity version, for whatever reason
		//(bool success, bytes memory returnData) = to.call{value: value, gas: gasleft()}(data);
		//if (!success) revert(string(data));
	}

	// EIP 1271 implementation
	// see https://eips.ethereum.org/EIPS/eip-1271
	function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
		if (privileges[SignatureValidator.recoverAddr(hash, signature)] != bytes32(0)) {
			// bytes4(keccak256("isValidSignature(bytes32,bytes)")
			return 0x1626ba7e;
		} else {
			return 0xffffffff;
		}
	}

	// EIP 1155 implementation
	// we pretty much only need to signal that we support the interface for 165, but for 1155 we also need the fallback function
	function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
		return
			interfaceID == 0x01ffc9a7 ||    // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
			interfaceID == 0x4e2312e0;      // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
	}
}
