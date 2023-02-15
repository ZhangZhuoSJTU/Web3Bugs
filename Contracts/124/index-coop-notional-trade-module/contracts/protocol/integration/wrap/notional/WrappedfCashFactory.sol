// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { WrappedfCashFactory as WrappedfCashFactoryBase } from "wrapped-fcash/contracts/proxy/WrappedfCashFactory.sol";

contract WrappedfCashFactory is WrappedfCashFactoryBase {
    constructor(address _beacon) WrappedfCashFactoryBase(_beacon){
    }
}
