//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface ApproveLike {
    function approve(address, uint256) external;
}

contract L1Escrow is AccessControl {
    event Approve(
        address indexed _token,
        address indexed _spender,
        uint256 _value
    );

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function approve(
        address _token,
        address _spender,
        uint256 _value
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        ApproveLike(_token).approve(_spender, _value);
        emit Approve(_token, _spender, _value);
    }
}
