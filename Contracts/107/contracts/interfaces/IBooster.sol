// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IBooster {
    function depositAll(uint256 _pid, bool _stake) external returns (bool);
}