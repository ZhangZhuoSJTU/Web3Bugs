// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "../interfaces/IInsurance.sol";

contract MockInsurance is IInsurance {
    address[] public underlyingVaults;
    address controller;
    uint256 public vaultDeltaIndex = 3;
    uint256[3] public vaultDeltaOrder = [1, 0, 2];

    mapping(uint256 => uint256) public underlyingTokensPercents;

    function calculateDepositDeltasOnAllVaults() external view override returns (uint256[3] memory deltas) {
        deltas[0] = 3333;
        deltas[1] = 3333;
        deltas[2] = 3333;
    }

    function rebalanceTrigger() external view override returns (bool sysNeedRebalance) {}

    function rebalance() external override {}

    function setController(address _controller) external {
        controller = _controller;
    }

    function setupTokens() external {
        underlyingTokensPercents[0] = 3000;
        underlyingTokensPercents[1] = 3000;
        underlyingTokensPercents[2] = 4000;
    }

    function rebalanceForWithdraw(uint256 withdrawUsd, bool pwrd) external override returns (bool) {}

    function setVaultDeltaIndex(uint256 _vaultDeltaIndex) external {
        require(_vaultDeltaIndex < 3, "invalid index");
        vaultDeltaIndex = _vaultDeltaIndex;
    }

    function getVaultDeltaForDeposit(uint256 amount)
        external
        view
        override
        returns (
            uint256[3] memory,
            uint256[3] memory,
            uint256
        )
    {
        amount;
        uint256[3] memory empty;
        if (vaultDeltaIndex == 3) {
            return (empty, vaultDeltaOrder, 3);
        } else {
            uint256[3] memory indexes;
            indexes[0] = vaultDeltaIndex;
            return (empty, indexes, 1);
        }
    }

    function calcSkim() external view override returns (uint256) {}

    function getStrategiesTargetRatio(uint256 utilRatio) external view override returns (uint256[] memory result) {
        result = new uint256[](2);
        result[0] = 5000;
        result[1] = 5000;
    }

    function getDelta(uint256 withdrawUsd) external view override returns (uint256[3] memory delta) {
        withdrawUsd;
        delta[0] = 3000;
        delta[1] = 3000;
        delta[2] = 4000;
    }

    function setUnderlyingTokenPercent(uint256 coinIndex, uint256 percent) external override {
        underlyingTokensPercents[coinIndex] = percent;
    }

    function sortVaultsByDelta(bool bigFirst) external view override returns (uint256[3] memory) {
        return vaultDeltaOrder;
    }
}
