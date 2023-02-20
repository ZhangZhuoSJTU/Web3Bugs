// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { wfCashERC4626 } from "wrapped-fcash/contracts/wfCashERC4626.sol";
import { INotionalV2 } from "wrapped-fcash/interfaces/notional/INotionalV2.sol";
import { IWETH9 } from "wrapped-fcash/interfaces/IWETH9.sol";

contract WrappedfCash is wfCashERC4626 {
    constructor(INotionalV2 _notionalProxy, IWETH9 _weth) wfCashERC4626(_notionalProxy, _weth){
    }
}
