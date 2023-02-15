// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iFACTORY{
    function deploySynth(address) external returns(address);
    function mintSynth(address, address, uint) external returns(bool);
    function getSynth(address) external view returns (address);
    function isSynth(address) external view returns (bool);
}