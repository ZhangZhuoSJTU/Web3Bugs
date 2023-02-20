// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IDepositHandler {
    function depositGvt(
        uint256[3] calldata inAmounts,
        uint256 minAmount,
        address _referral
    ) external;

    function depositPwrd(
        uint256[3] calldata inAmounts,
        uint256 minAmount,
        address _referral
    ) external;
}
