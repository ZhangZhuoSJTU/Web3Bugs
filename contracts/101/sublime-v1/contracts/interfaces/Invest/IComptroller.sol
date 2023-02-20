// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IComptroller {
    function claimComp(address) external;

    function compSpeeds(address _cToken) external view returns (uint256);

    function compSupplySpeeds(address _cToken) external view returns (uint256);

    function claimComp(
        address[] calldata holders,
        address[] calldata cTokens,
        bool borrowers,
        bool suppliers
    ) external;

    function getAccountLiquidity(address account)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function enterMarkets(address[] calldata cTokens) external returns (uint256[] memory);
}
