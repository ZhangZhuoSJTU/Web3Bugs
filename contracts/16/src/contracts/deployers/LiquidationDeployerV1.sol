// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../Liquidation.sol";
import "../Interfaces/deployers/ILiquidationDeployer.sol";

/**
 * Deployer contract. Used by the Tracer Factory to deploy new Tracer markets
 */
contract LiquidationDeployerV1 is ILiquidationDeployer {
    function deploy(
        address pricing,
        address tracer,
        address insuranceContract,
        address fastGasOracle,
        uint256 maxSlippage
    ) external override returns (address) {
        Liquidation liquidation = new Liquidation(pricing, tracer, insuranceContract, fastGasOracle, maxSlippage);
        liquidation.transferOwnership(msg.sender);
        return address(liquidation);
    }
}
