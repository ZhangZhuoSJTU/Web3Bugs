// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
interface iSYNTH {
    function genesis() external view returns(uint);
    function totalMinted() external view returns(uint);
    function LayerONE()external view returns(address);
    function mintSynth(address, uint) external returns (uint256);
    function burnSynth() external returns(uint);
    function realise(address pool) external;
}
