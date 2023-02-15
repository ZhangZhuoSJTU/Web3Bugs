//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ICoreFactory {
    function collection() external view returns (address);
    function splitFactory() external view returns (address);
}
