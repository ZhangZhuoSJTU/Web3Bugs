// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "hardhat/console.sol";

contract DaiMockup {
    function approve(address _address, uint256 _amount)
        external
        pure
        returns (bool)
    {
        _address;
        _amount;
        return true;
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure returns (bool) {
        return true;
    }
}
