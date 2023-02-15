// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../../interfaces/vendor/IGauge.sol";
import "./../MockErc20.sol";

contract MockMinter is IMinter {
    address public token;

    uint256 private _mintAmount;

    constructor(address _token) {
        token = _token;
    }

    function setMintAmount(uint256 mintAmount_) external {
        _mintAmount = mintAmount_;
    }

    function mint(
        address /* gaugeAddr */
    ) external override {
        MockErc20(token).mintFor(msg.sender, _mintAmount);
    }
}
