pragma solidity ^0.8.4;

import "./Algorithm.sol";

/**
* @dev Implements a dummy DNSSEC (signing) algorithm that approves all
*      signatures, for testing.
*/
contract DummyAlgorithm is Algorithm {
    function verify(bytes calldata, bytes calldata, bytes calldata) external override view returns (bool) { return true; }
}
