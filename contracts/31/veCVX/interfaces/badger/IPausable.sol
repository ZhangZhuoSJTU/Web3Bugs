// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IPausable {
    function pause() external;

    function unpause() external;
}
