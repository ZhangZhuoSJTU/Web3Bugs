// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../actions/topup/TopUpActionFeeHandler.sol";

contract MockTopUpActionFeeHandler is TopUpActionFeeHandler {
    constructor(
        IController _controller,
        address _actionContract,
        uint256 keeperFee,
        uint256 treasuryFee
    ) TopUpActionFeeHandler(_controller, _actionContract, keeperFee, treasuryFee) {}

    function callReportFees(
        address beneficiary,
        uint256 amount,
        address lpTokenAddress
    ) external {
        address keeperGauge = getKeeperGauge(lpTokenAddress);
        IKeeperGauge(keeperGauge).reportFees(beneficiary, amount, lpTokenAddress);
    }
}
