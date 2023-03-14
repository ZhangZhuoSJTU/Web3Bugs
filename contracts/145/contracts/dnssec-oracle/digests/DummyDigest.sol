pragma solidity ^0.8.4;

import "./Digest.sol";

/**
* @dev Implements a dummy DNSSEC digest that approves all hashes, for testing.
*/
contract DummyDigest is Digest {
    function verify(bytes calldata, bytes calldata) external override pure returns (bool) { return true; }
}
