// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "../strategy/IStrategy.sol";
import {BaseStrategy} from "../strategy/BaseStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockStrategy is BaseStrategy {
    constructor(
        address _vault,
        address _treasury,
        address _ethAnchorRouter,
        address _exchangeRateFeeder,
        IERC20 _ustToken,
        IERC20 _aUstToken,
        uint16 _perfFeePct
    )
        BaseStrategy(
            _vault,
            _treasury,
            _ethAnchorRouter,
            _exchangeRateFeeder,
            _ustToken,
            _aUstToken,
            _perfFeePct,
            msg.sender
        )
    {}

    function doHardWork() external override(BaseStrategy) restricted {}
}
