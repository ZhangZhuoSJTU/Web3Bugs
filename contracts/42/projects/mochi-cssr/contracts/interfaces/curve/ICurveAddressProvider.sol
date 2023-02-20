// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

//0x0000000022D53366457F9d5E68Ec105046FC4383

interface ICurveAddressProvider {
    function get_registry() external view returns (address);
}
