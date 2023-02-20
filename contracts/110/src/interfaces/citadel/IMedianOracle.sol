/// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0 <=0.9.0;

interface IMedianOracle {
    function getData() external returns (uint256, bool);
}
