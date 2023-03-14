pragma solidity >=0.8.4;

contract DummyOracle {
    int value;

    constructor(int _value) public {
        set(_value);
    }

    function set(int _value) public {
        value = _value;
    }

    function latestAnswer() public view returns(int256) {
        return value;
    }
}
