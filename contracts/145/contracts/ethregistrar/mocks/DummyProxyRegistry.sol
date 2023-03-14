pragma solidity >=0.8.4;

contract DummyProxyRegistry {
    address target;

    constructor(address _target) public {
        target = _target;
    }

    function proxies(address a) external view returns(address) {
        return target;
    }
}
