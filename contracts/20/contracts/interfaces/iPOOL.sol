// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
interface iPOOL {
    function TOKEN() external view returns(address);
    function removeLiquidity() external returns (uint, uint);
    function genesis() external view returns(uint);
    function baseAmount() external view returns(uint);
    function tokenAmount() external view returns(uint);
    function fees() external view returns(uint);
    function volume() external view returns(uint);
    function txCount() external view returns(uint);
    function mintSynth(address, address) external returns (uint256, uint256);
}