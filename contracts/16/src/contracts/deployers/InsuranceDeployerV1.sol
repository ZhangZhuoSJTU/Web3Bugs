// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../Insurance.sol";
import "../Interfaces/deployers/IInsuranceDeployer.sol";

/**
 * Deployer contract. Used by the Tracer Factory to deploy new Tracer markets
 */
contract InsuranceDeployerV1 is IInsuranceDeployer {
    function deploy(address tracer) external override returns (address) {
        Insurance insurance = new Insurance(tracer);
        return address(insurance);
    }
}
