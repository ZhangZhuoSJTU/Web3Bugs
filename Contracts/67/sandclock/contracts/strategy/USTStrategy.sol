// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BaseStrategy.sol";

/**
 * A strategy that uses UST as the underlying currency
 *
 * @notice The base implementation for EthAnchorUSTBaseStrategy already handles
 * everything, since in this case _underlying and _ustToken are the same token
 */
contract USTStrategy is BaseStrategy {
    constructor(
        address _vault,
        address _treasury,
        address _ethAnchorRouter,
        address _exchangeRateFeeder,
        IERC20 _ustToken,
        IERC20 _aUstToken,
        uint16 _perfFeePct,
        address _owner
    )
        BaseStrategy(
            _vault,
            _treasury,
            _ethAnchorRouter,
            _exchangeRateFeeder,
            _ustToken,
            _aUstToken,
            _perfFeePct,
            _owner
        )
    {
        require(underlying == _ustToken, "invalid underlying");
    }
}
