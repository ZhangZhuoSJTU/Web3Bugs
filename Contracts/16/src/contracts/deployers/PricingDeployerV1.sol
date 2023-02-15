// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../Pricing.sol";
import "../Interfaces/deployers/IPricingDeployer.sol";

/**
 * Deployer contract. Used by the Tracer Factory to deploy new Tracer markets
 */
contract PricingDeployerV1 is IPricingDeployer {
    function deploy(
        address tracer,
        address insuranceContract,
        address oracle
    ) external override returns (address) {
        Pricing pricing = new Pricing(tracer, insuranceContract, oracle);
        return address(pricing);
    }
}
