// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../DAO/Governable.sol";

contract GovernableStub is Governable {
    constructor(address dao) Governable(dao) {}

    function userTokenBalance(address token) public view returns (uint256) {
        return 0;
    }
}
