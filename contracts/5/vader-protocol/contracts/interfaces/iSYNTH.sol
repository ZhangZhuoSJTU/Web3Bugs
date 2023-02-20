// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iSYNTH {
    function mint(address account, uint amount) external;
    function TOKEN() external view returns(address);
}