// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IFeeBurner {
    function burnToTarget(address[] memory tokens, address targetLpToken)
        external
        payable
        returns (uint256);
}
