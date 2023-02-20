// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IEthAnchorRouter {
    function initDepositStable(uint256 _amount) external returns (address);

    function finishDepositStable(address _operation) external;

    function initRedeemStable(uint256 _amount) external returns (address);

    function finishRedeemStable(address _operation) external;
}
