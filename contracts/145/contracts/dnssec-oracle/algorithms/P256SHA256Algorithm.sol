pragma solidity ^0.8.4;

import "./Algorithm.sol";
import "./EllipticCurve.sol";
import "../BytesUtils.sol";

contract P256SHA256Algorithm is Algorithm, EllipticCurve {

    using BytesUtils for *;

    /**
    * @dev Verifies a signature.
    * @param key The public key to verify with.
    * @param data The signed data to verify.
    * @param signature The signature to verify.
    * @return True iff the signature is valid.
    */
    function verify(bytes calldata key, bytes calldata data, bytes calldata signature) external override view returns (bool) {
        return validateSignature(sha256(data), parseSignature(signature), parseKey(key));
    }

    function parseSignature(bytes memory data) internal pure returns (uint256[2] memory) {
        require(data.length == 64, "Invalid p256 signature length");
        return [uint256(data.readBytes32(0)), uint256(data.readBytes32(32))];
    }

    function parseKey(bytes memory data) internal pure returns (uint256[2] memory) {
        require(data.length == 68, "Invalid p256 key length");
        return [uint256(data.readBytes32(4)), uint256(data.readBytes32(36))];
    }
}
