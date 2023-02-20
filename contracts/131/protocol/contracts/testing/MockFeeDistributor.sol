// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/vendor/IGauge.sol";

contract MockFeeDistributor is IFeeDistributor {
    uint256 private _feeToClaim = 100;

    // this is for mocking fees
    function setFeeToClaim(uint256 _fee) external {
        _feeToClaim = _fee;
    }

    function claim(address) external view override returns (uint256) {
        return _feeToClaim;
    }
}
