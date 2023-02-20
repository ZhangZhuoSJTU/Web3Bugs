// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

// https://forum.openzeppelin.com/t/can-not-call-the-function-approve-of-the-usdt-contract/2130/2
interface USDT {
    function approve(address guy, uint256 wad) external;

    function transfer(address _to, uint256 _value) external;
}
