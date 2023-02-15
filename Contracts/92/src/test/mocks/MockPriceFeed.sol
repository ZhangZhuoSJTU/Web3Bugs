// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {CERC20} from "../../interfaces/CERC20.sol";
import {PriceFeed} from "../../interfaces/PriceFeed.sol";

contract MockPriceFeed is PriceFeed {
    mapping(CERC20 => uint256) public override getUnderlyingPrice;

    function setUnderlyingPrice(CERC20 cToken, uint256 priceFeed) external {
        getUnderlyingPrice[cToken] = priceFeed;
    }
}
