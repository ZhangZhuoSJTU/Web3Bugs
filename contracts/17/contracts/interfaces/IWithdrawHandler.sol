// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IWithdrawHandler {
    function withdrawByLPToken(
        bool pwrd,
        uint256 lpAmount,
        uint256[3] calldata minAmounts
    ) external;

    function withdrawByStablecoin(
        bool pwrd,
        uint256 index,
        uint256 lpAmount,
        uint256 minAmount
    ) external;

    function withdrawAllSingle(
        bool pwrd,
        uint256 index,
        uint256 minAmount
    ) external;

    function withdrawAllBalanced(bool pwrd, uint256[3] calldata minAmounts) external;
}
