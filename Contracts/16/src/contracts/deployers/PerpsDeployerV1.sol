// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../TracerPerpetualSwaps.sol";
import "../Interfaces/deployers/IPerpsDeployer.sol";

/**
 * Deployer contract. Used by the Tracer Factory to deploy new Tracer markets
 */
contract PerpsDeployerV1 is IPerpsDeployer {
    function deploy(bytes calldata _data) external override returns (address) {
        (
            bytes32 _tracerId,
            address _tracerQuoteToken,
            uint256 _tokenDecimals,
            address _gasPriceOracle,
            uint256 _maxLeverage,
            uint256 _fundingRateSensitivity,
            uint256 _feeRate,
            address _feeReceiver,
            uint256 _deleveragingCliff,
            uint256 _lowestMaxLeverage,
            uint256 _insurancePoolSwitchStage
        ) = abi.decode(
            _data,
            (bytes32, address, uint256, address, uint256, uint256, uint256, address, uint256, uint256, uint256)
        );
        TracerPerpetualSwaps tracer = new TracerPerpetualSwaps(
            _tracerId,
            _tracerQuoteToken,
            _tokenDecimals,
            _gasPriceOracle,
            _maxLeverage,
            _fundingRateSensitivity,
            _feeRate,
            _feeReceiver,
            _deleveragingCliff,
            _lowestMaxLeverage,
            _insurancePoolSwitchStage
        );
        tracer.transferOwnership(msg.sender);
        return address(tracer);
    }
}
