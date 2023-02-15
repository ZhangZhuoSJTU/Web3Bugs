// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../StakerVault.sol";
import "../../LpToken.sol";

contract StakerVaultProfiler {
    StakerVault public stakerVault;

    constructor(address _stakerVault) {
        stakerVault = StakerVault(_stakerVault);
        LpToken(stakerVault.token()).approve(address(stakerVault), type(uint256).max);
    }

    function profileStake(uint256 amount) external {
        stakerVault.stake(amount);
        stakerVault.stake(amount);
        stakerVault.stake(amount);
        stakerVault.stake(amount);

        stakerVault.unstake(amount);
        stakerVault.unstake(amount);
        stakerVault.unstake(amount);
    }
}
