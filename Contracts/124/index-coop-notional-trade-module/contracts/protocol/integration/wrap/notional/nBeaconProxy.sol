// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { nBeaconProxy as nBeaconProxyBase } from "wrapped-fcash/contracts/proxy/nBeaconProxy.sol";

contract nBeaconProxy is nBeaconProxyBase {
    constructor(address beacon, bytes memory data) payable nBeaconProxyBase(beacon, data) { }
}
