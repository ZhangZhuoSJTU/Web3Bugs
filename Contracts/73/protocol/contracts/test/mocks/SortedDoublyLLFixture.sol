pragma solidity ^0.5.11;

import "../../libraries/SortedDoublyLL.sol";

contract SortedDoublyLLFixture {
    using SortedDoublyLL for SortedDoublyLL.Data;

    SortedDoublyLL.Data list;

    function setMaxSize(uint256 _size) public {
        list.setMaxSize(_size);
    }

    function insert(
        address _id,
        uint256 _key,
        address _prevId,
        address _nextId
    ) public {
        list.insert(_id, _key, _prevId, _nextId);
    }

    function remove(address _id) public {
        list.remove(_id);
    }

    function updateKey(
        address _id,
        uint256 _newKey,
        address _prevId,
        address _nextId
    ) public {
        list.updateKey(_id, _newKey, _prevId, _nextId);
    }

    function contains(address _id) public view returns (bool) {
        return list.contains(_id);
    }

    function getSize() public view returns (uint256) {
        return list.getSize();
    }

    function getMaxSize() public view returns (uint256) {
        return list.maxSize;
    }

    function getKey(address _id) public view returns (uint256) {
        return list.getKey(_id);
    }

    function getFirst() public view returns (address) {
        return list.getFirst();
    }

    function getLast() public view returns (address) {
        return list.getLast();
    }

    function getNext(address _id) public view returns (address) {
        return list.getNext(_id);
    }

    function getPrev(address _id) public view returns (address) {
        return list.getPrev(_id);
    }
}
