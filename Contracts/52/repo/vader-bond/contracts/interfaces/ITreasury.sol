// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

interface ITreasury {
    function deposit(
        address _principalToken,
        uint _principalAmount,
        uint _payoutAmount
    ) external;

    function valueOfToken(address _principalToken, uint _amount) external view returns (uint value);
}
