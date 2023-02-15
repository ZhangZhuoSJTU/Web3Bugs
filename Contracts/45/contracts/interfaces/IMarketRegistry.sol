//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title MarketRegistry Interface
 * @dev Registering and managing all the lending markets.
 */
interface IMarketRegistry {
    function getUTokens() external view returns (address[] memory);

    function getUserManagers() external view returns (address[] memory);

    /**
     *  @dev Returns the market address of the token
     *  @return The market address
     */
    function tokens(address token) external view returns (address, address);

    function createUToken(
        address token,
        address assetManager,
        uint256 originationFee,
        uint256 globalMaxLoan,
        uint256 maxBorrow,
        uint256 minLoan,
        uint256 maxLateBlock,
        address interestRateModel
    ) external returns (address);

    function createUserManager(
        address assetManager,
        address unionToken,
        address stakingToken,
        address creditLimitModel,
        address inflationIndexModel,
        address comptroller
    ) external returns (address);
}
