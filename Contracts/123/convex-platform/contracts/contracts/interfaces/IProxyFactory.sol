// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IProxyFactory {
    function clone(address _target) external returns(address);
}