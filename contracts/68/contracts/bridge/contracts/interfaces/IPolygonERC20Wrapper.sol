//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface IPolygonERC20Wrapper {
    function underlying() external view returns (address);

    function withdrawTo(uint256 amount, address reciver) external;
}
