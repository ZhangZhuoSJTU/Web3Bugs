// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.7;

import "./BytesLib.sol";

interface IERC1271Wallet {
	function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

library SignatureValidator {
	using LibBytes for bytes;

	enum SignatureMode {
		NoSig,
		EIP712,
		EthSign,
		SmartWallet,
		Spoof,
		// must be at the end
		Unsupported
	}

	// bytes4(keccak256("isValidSignature(bytes32,bytes)"))
	bytes4 constant internal ERC1271_MAGICVALUE_BYTES32 = 0x1626ba7e;

	function recoverAddr(bytes32 hash, bytes memory sig) internal view returns (address) {
		return recoverAddrImpl(hash, sig, false);
	}

	function recoverAddrImpl(bytes32 hash, bytes memory sig, bool allowSpoofing) internal view returns (address) {
		require(sig.length >= 1, "SignatureValidator: basic sig len");
		uint8 modeRaw = uint8(sig[sig.length - 1]);
		require(modeRaw < uint8(SignatureMode.Unsupported), "SignatureValidator: unsupported sig mode");
		SignatureMode mode = SignatureMode(modeRaw);

		if (mode == SignatureMode.NoSig) {
			return address(0x0);
		}

		// {r}{s}{v}{mode}
		if (mode == SignatureMode.EIP712 || mode == SignatureMode.EthSign) {
			require(sig.length == 66, "SignatureValidator: sig len");
			bytes32 r = sig.readBytes32(0);
			bytes32 s = sig.readBytes32(32);
			// @TODO: is there a gas saving to be had here by using assembly?
			uint8 v = uint8(sig[64]);
			// Hesitant about this check: seems like this is something that has no business being checked on-chain
			require(v == 27 || v == 28, "invalid v");
			if (mode == SignatureMode.EthSign) hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
			return ecrecover(hash, v, r, s);
		}
		// {sig}{verifier}{mode}
		if (mode == SignatureMode.SmartWallet) {
			// 32 bytes for the addr, 1 byte for the type = 33
			require(sig.length > 33, "SignatureValidator: wallet sig len");
			// @TODO: can we pack the addr tigher into 20 bytes? should we?
			IERC1271Wallet wallet = IERC1271Wallet(address(uint160(uint256(sig.readBytes32(sig.length - 33)))));
			sig.trimToSize(sig.length - 33);
			require(ERC1271_MAGICVALUE_BYTES32 == wallet.isValidSignature(hash, sig), "SignatureValidator: invalid wallet sig");
			return address(wallet);
		}
		// {address}{mode}; the spoof mode is used when simulating calls
		if (mode == SignatureMode.Spoof && allowSpoofing) {
			require(tx.origin == address(1), "SignatureValidator: spoof must be used with specific addr");
			require(sig.length == 33, "SignatureValidator: spoof sig len");
			sig.trimToSize(32);
			return abi.decode(sig, (address));
		}
		return address(0x00);
	}
}
