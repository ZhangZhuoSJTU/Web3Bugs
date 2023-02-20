// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

// Interface for Joe zapper which can take any token or avax payable. 
interface IJoeZapper {
    function zapInToken(address _from, uint256 amount, address _to) external;

    function zapIn(address _to) external payable;
}



