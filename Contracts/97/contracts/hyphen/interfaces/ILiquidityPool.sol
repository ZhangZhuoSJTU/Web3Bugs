// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ILiquidityPool {
    function baseGas() external view returns (uint256);

    function changePauser(address newPauser) external;

    function checkHashStatus(
        address tokenAddress,
        uint256 amount,
        address receiver,
        bytes memory depositHash
    ) external view returns (bytes32 hashSendTransaction, bool status);

    function depositConfig(uint256, address) external view returns (uint256 min, uint256 max);

    function depositErc20(
        uint256 toChainId,
        address tokenAddress,
        address receiver,
        uint256 amount,
        string memory tag
    ) external;

    function depositNative(
        address receiver,
        uint256 toChainId,
        string memory tag
    ) external;

    function gasFeeAccumulated(address, address) external view returns (uint256);

    function gasFeeAccumulatedByToken(address) external view returns (uint256);

    function getCurrentLiquidity(address tokenAddress) external view returns (uint256 currentLiquidity);

    function getExecutorManager() external view returns (address);

    function getRewardAmount(uint256 amount, address tokenAddress) external view returns (uint256 rewardAmount);

    function getTransferFee(address tokenAddress, uint256 amount) external view returns (uint256 fee);

    function incentivePool(address) external view returns (uint256);

    function initialize(
        address _executorManagerAddress,
        address pauser,
        address _trustedForwarder,
        address _tokenManager,
        address _liquidityProviders
    ) external;

    function isPauser(address pauser) external view returns (bool);

    function isTrustedForwarder(address forwarder) external view returns (bool);

    function owner() external view returns (address);

    function paused() external view returns (bool);

    function processedHash(bytes32) external view returns (bool);

    function renounceOwnership() external;

    function renouncePauser() external;

    function transfer(address _tokenAddress, address receiver, uint256 _tokenAmount) external;

    function sendFundsToUser(
        address tokenAddress,
        uint256 amount,
        address receiver,
        bytes memory depositHash,
        uint256 tokenGasPrice,
        uint256 fromChainId
    ) external;

    function setBaseGas(uint128 gas) external;

    function setExecutorManager(address _executorManagerAddress) external;

    function setLiquidityProviders(address _liquidityProviders) external;

    function setTrustedForwarder(address trustedForwarder) external;

    function transferConfig(address) external view returns (uint256 min, uint256 max);

    function transferOwnership(address newOwner) external;

    function withdrawErc20GasFee(address tokenAddress) external;

    function withdrawNativeGasFee() external;
}
