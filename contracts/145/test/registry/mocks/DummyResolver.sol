pragma solidity >=0.8.4;

contract DummyResolver {

    mapping (bytes32 => string) public name;

    function setName(bytes32 node, string memory _name) public {
        name[node] = _name;
    }
}
