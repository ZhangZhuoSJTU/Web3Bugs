pragma solidity ^0.8.7;

contract SimplePoolMock {
    constructor() {}

    uint256 u;

    function utilizationRate() external view returns (uint256) {
        return u;
    }

    function changeU(uint256 _u) external {
        u = _u;
    }
}
