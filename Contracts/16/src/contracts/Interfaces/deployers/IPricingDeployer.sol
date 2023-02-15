//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface IPricingDeployer {
    function deploy(
        address tracer,
        address insuranceContract,
        address oracle
    ) external returns (address);
}
