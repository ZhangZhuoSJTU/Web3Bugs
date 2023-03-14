pragma solidity ^0.8.4;

/**
* @dev Implements a dummy NameWrapper which returns the caller's address
*/
contract DummyNameWrapper {
    function ownerOf(uint256 /* id */) public view returns (address) {
        return tx.origin;
    }
}
