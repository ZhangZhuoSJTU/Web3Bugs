// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ITokenManager {

    struct TokenInfo {
        uint256 transferOverhead;
        bool supportedToken;
        uint256 equilibriumFee; // Percentage fee Represented in basis points
        uint256 maxFee; // Percentage fee Represented in basis points
        TokenConfig tokenConfig;
    }

    struct TokenConfig {
        uint256 min;
        uint256 max;
    }
    
    function getEquilibriumFee(address tokenAddress) external view returns (uint256);

    function getMaxFee(address tokenAddress) external view returns (uint256);

    function changeFee(
        address tokenAddress,
        uint256 _equilibriumFee,
        uint256 _maxFee
    ) external;

    function getTokensInfo(address tokenAddress) external view returns (TokenInfo memory);

    function getDepositConfig(uint256 toChainId, address tokenAddress) external view returns (TokenConfig memory);

    function getTransferConfig(address tokenAddress) external view returns (TokenConfig memory);
}
