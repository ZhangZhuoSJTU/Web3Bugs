// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "./ERC1967/ERC1967Proxy.sol";

contract nProxy is ERC1967Proxy {
    constructor(
        address _logic,
        bytes memory _data
    ) ERC1967Proxy(_logic, _data) {}

    receive() external payable override {}

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }
}