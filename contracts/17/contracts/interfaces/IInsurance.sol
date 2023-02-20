// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IInsurance {
    function calculateDepositDeltasOnAllVaults() external view returns (uint256[3] memory);

    function rebalanceTrigger() external view returns (bool sysNeedRebalance);

    function rebalance() external;

    function calcSkim() external view returns (uint256);

    function rebalanceForWithdraw(uint256 withdrawUsd, bool pwrd) external returns (bool);

    function getDelta(uint256 withdrawUsd) external view returns (uint256[3] memory delta);

    function getVaultDeltaForDeposit(uint256 amount)
        external
        view
        returns (
            uint256[3] memory,
            uint256[3] memory,
            uint256
        );

    function sortVaultsByDelta(bool bigFirst) external view returns (uint256[3] memory vaultIndexes);

    function getStrategiesTargetRatio(uint256 utilRatio) external view returns (uint256[] memory);

    function setUnderlyingTokenPercent(uint256 coinIndex, uint256 percent) external;
}
