// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "../BentoBoxFlat.sol";

contract BentoBoxMock is BentoBoxV1 {
    constructor(IERC20 weth) public BentoBoxV1(weth) {
        return;
    }

    function addProfit(IERC20 token, uint256 amount) public {
        token.safeTransferFrom(msg.sender, address(this), amount);
        totals[token].addElastic(amount);
    }

    function takeLoss(IERC20 token, uint256 amount) public {
        token.safeTransfer(msg.sender, amount);
        totals[token].subElastic(amount);
    }
}
