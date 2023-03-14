pragma solidity ^0.8.4;

import "./Algorithm.sol";
import "../BytesUtils.sol";
import "./RSAVerify.sol";
import "@ensdomains/solsha1/contracts/SHA1.sol";

/**
* @dev Implements the DNSSEC RSASHA1 algorithm.
*/
contract RSASHA1Algorithm is Algorithm {
    using BytesUtils for *;

    function verify(bytes calldata key, bytes calldata data, bytes calldata sig) external override view returns (bool) {
        bytes memory exponent;
        bytes memory modulus;

        uint16 exponentLen = uint16(key.readUint8(4));
        if (exponentLen != 0) {
            exponent = key.substring(5, exponentLen);
            modulus = key.substring(exponentLen + 5, key.length - exponentLen - 5);
        } else {
            exponentLen = key.readUint16(5);
            exponent = key.substring(7, exponentLen);
            modulus = key.substring(exponentLen + 7, key.length - exponentLen - 7);
        }

        // Recover the message from the signature
        bool ok;
        bytes memory result;
        (ok, result) = RSAVerify.rsarecover(modulus, exponent, sig);

        // Verify it ends with the hash of our data
        return ok && SHA1.sha1(data) == result.readBytes20(result.length - 20);
    }
}
