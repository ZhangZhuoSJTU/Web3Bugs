// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../IPreparable.sol";

interface IActionFeeHandler is IPreparable {
    function payFees(
        address payer,
        address keeper,
        uint256 amount,
        address token
    ) external returns (bool);

    function claimKeeperFeesForPool(address keeper, address token) external returns (bool);

    function claimTreasuryFees(address token) external returns (bool);

    function setInitialKeeperGaugeForToken(address lpToken, address _keeperGauge)
        external
        returns (bool);

    function prepareKeeperFee(uint256 newKeeperFee) external returns (bool);

    function executeKeeperFee() external returns (uint256);

    function resetKeeperFee() external returns (bool);

    function prepareKeeperGauge(address lpToken, address newKeeperGauge) external returns (bool);

    function executeKeeperGauge(address lpToken) external returns (address);

    function resetKeeperGauge(address lpToken) external returns (bool);

    function prepareTreasuryFee(uint256 newTreasuryFee) external returns (bool);

    function executeTreasuryFee() external returns (uint256);

    function resetTreasuryFee() external returns (bool);

    function getKeeperFeeFraction() external view returns (uint256);

    function getKeeperGauge(address lpToken) external view returns (address);

    function getTreasuryFeeFraction() external view returns (uint256);
}
