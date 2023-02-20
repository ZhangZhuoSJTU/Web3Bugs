// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IDefender {
    function isAllowed(address) external returns (bool);
}
