// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/IStakerVault.sol";
import "../../interfaces/IVault.sol";

import "../pool/Erc20Pool.sol";

contract MockErc20Pool is Erc20Pool {
    uint256 public currentTime;

    constructor(IController _controller) Erc20Pool(_controller) {}

    function setMinWithdrawalFee(uint256 _newFee) external onlyGovernance returns (bool) {
        _setConfig(_MIN_WITHDRAWAL_FEE_KEY, _newFee);
        return true;
    }

    function setMaxWithdrawalFee(uint256 _newFee) external onlyGovernance returns (bool) {
        _setConfig(_MAX_WITHDRAWAL_FEE_KEY, _newFee);
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
