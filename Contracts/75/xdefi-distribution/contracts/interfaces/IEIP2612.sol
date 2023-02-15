// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

interface IEIP2612 {

    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) external;

}
