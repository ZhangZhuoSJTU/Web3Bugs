// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../pool/EthPool.sol";

contract MockEthPool is EthPool {
    uint256 public currentTime;

    constructor(IController _controller) EthPool(_controller) {}

    function setMinWithdrawalFee(uint256 newFee) external onlyGovernance returns (bool) {
        _setConfig(_MIN_WITHDRAWAL_FEE_KEY, newFee);
        _checkFeeInvariants(newFee, getMaxWithdrawalFee());
        return true;
    }

    function setMaxWithdrawalFee(uint256 newFee) external onlyGovernance returns (bool) {
        _setConfig(_MAX_WITHDRAWAL_FEE_KEY, newFee);
        _checkFeeInvariants(getMinWithdrawalFee(), newFee);
        return true;
    }

    function setWithdrawalFeeDecreasePeriod(uint256 period) external onlyGovernance returns (bool) {
        _setConfig(_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY, period);
        return true;
    }

    function setVault(address payable _vault) external {
        setVault(_vault, true);
    }

    function setMaxBackingReserveDeviationRatio(uint256 newRatio) external onlyGovernance {
        _setConfig(_RESERVE_DEVIATION_KEY, newRatio);
        _rebalanceVault();
    }

    function setRequiredBackingReserveRatio(uint256 newRatio) external onlyGovernance {
        _setConfig(_REQUIRED_RESERVES_KEY, newRatio);
        _rebalanceVault();
    }

    function setTime(uint256 _currentTime) external {
        currentTime = _currentTime;
    }

    function setVault(address payable _vault, bool updateAddressProvider) public onlyGovernance {
        if (updateAddressProvider) {
            addressProvider.updateVault(currentAddresses[_VAULT_KEY], _vault);
        }
        _setConfig(_VAULT_KEY, _vault);
    }

    function _getTime() internal view override returns (uint256) {
        return currentTime == 0 ? block.timestamp : currentTime;
    }
}
