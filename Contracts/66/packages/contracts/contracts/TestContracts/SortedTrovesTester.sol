// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Interfaces/ISortedTroves.sol";
import "../SortedTroves.sol";

// Testing file for sorted troves without checks, can reinsert any time. 

contract SortedTrovesTester is SortedTroves {
    
    function callInsert(address _id, uint256 _ICR, address _prevId, address _nextId) external {
        _insert(_id, _ICR, _prevId, _nextId);
    }

    function callRemove(address _id) external {
        _remove(_id);
    }

    function callReInsert(address _id, uint256 _newICR, address _prevId, address _nextId) external {
        require(contains(_id), "SortedTroves: List does not contain the id");
        // ICR must be non-zero
        require(_newICR != 0, "SortedTroves: ICR must be positive");

        // Remove node from the list
        _remove(_id);

        _insert(_id, _newICR, _prevId, _nextId);
    }
}