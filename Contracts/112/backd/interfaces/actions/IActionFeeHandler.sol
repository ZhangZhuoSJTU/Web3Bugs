// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

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
}
