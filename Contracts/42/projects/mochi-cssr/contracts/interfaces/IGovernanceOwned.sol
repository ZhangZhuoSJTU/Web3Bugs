// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IGovernanceOwned {
    function governance() external view returns (address);
}
