// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../../interfaces/pool/ILiquidityPool.sol";
import "../../../interfaces/actions/topup/ITopUpAction.sol";

import "../../pool/LiquidityPool.sol";
import "../../actions/topup/TopUpAction.sol";
import "../../LpToken.sol";

contract TopUpActionProfiler {
    TopUpAction public topUpAction;

    constructor(address _topUpAction, address lpToken) {
        topUpAction = TopUpAction(payable(_topUpAction));
        LpToken(lpToken).approve(address(topUpAction), type(uint256).max);
    }

    function profileRegister(
        bytes32 account,
        bytes32 protocol,
        uint64 threshold,
        address depositToken,
        uint128 depositAmount,
        address actionToken,
        uint128 singleTopUpAmount,
        uint128 totalTopUpAmount,
        bytes memory extra
    ) external {
        topUpAction.register(
            account,
            protocol,
            depositAmount,
            ITopUpAction.Record({
                threshold: threshold,
                priorityFee: 10**9,
                maxFee: 30 * 10**9,
                registeredAt: 0,
                actionToken: actionToken,
                depositToken: depositToken,
                singleTopUpAmount: singleTopUpAmount,
                totalTopUpAmount: totalTopUpAmount,
                depositTokenBalance: 0,
                extra: extra
            })
        );

        topUpAction.resetPosition(account, protocol, true);

        topUpAction.register(
            account,
            protocol,
            depositAmount,
            ITopUpAction.Record({
                threshold: threshold,
                priorityFee: 10**9,
                maxFee: 30 * 10**9,
                registeredAt: 0,
                actionToken: actionToken,
                depositToken: depositToken,
                singleTopUpAmount: singleTopUpAmount,
                totalTopUpAmount: totalTopUpAmount,
                depositTokenBalance: 0,
                extra: extra
            })
        );
    }

    function simpleRegister(
        bytes32 account,
        bytes32 protocol,
        uint64 threshold,
        address depositToken,
        uint128 depositAmount,
        address actionToken,
        uint128 singleTopUpAmount,
        uint128 totalTopUpAmount,
        bytes memory extra
    ) external {
        topUpAction.register(
            account,
            protocol,
            depositAmount,
            ITopUpAction.Record({
                threshold: threshold,
                priorityFee: 10**9,
                maxFee: 30 * 10**9,
                registeredAt: 0,
                actionToken: actionToken,
                depositToken: depositToken,
                singleTopUpAmount: singleTopUpAmount,
                totalTopUpAmount: totalTopUpAmount,
                depositTokenBalance: 0,
                extra: extra
            })
        );
    }

    function profileExecute(
        address payer,
        bytes32 account,
        address beneficiary,
        bytes32 protocol
    ) external {
        topUpAction.execute(payer, account, beneficiary, protocol, 0);
    }
}
