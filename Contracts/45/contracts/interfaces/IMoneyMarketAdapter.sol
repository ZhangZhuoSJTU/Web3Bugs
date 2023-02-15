//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title MoneyMarketAdapter Interface
 *  @dev Working with AssetManager to support external money markets, like Compound etc.
 */
interface IMoneyMarketAdapter {
    /**
     * @dev Returns the interest rate per block for the given token.
     */
    function getRate(address tokenAddress) external view returns (uint256);

    /**
     * @dev Deposits the given amount of tokens in the underlying money market.
     */
    function deposit(address tokenAddress) external;

    /**
     * @dev Withdraws the given amount of tokens from the underlying money market and transfers them to `recipient`.
     */
    function withdraw(
        address tokenAddress,
        address recipient,
        uint256 amount
    ) external;

    /**
     * @dev Withdraws all the tokens from the underlying money market and transfers them to `recipient`.
     */
    function withdrawAll(address tokenAddress, address recipient) external;

    function claimTokens(address tokenAddress, address recipient) external;

    /**
     * @dev Returns the supply for the given token, including accrued interest. This function can have side effects.
     */
    function getSupply(address tokenAddress) external returns (uint256);

    /**
     * @dev Returns the supply for the given token; it might not include accrued interest. This function *cannot* have side effects.
     */
    function getSupplyView(address tokenAddress) external view returns (uint256);

    /**
     * @dev Indicates if the adapter supports the token with the given address.
     */
    function supportsToken(address tokenAddress) external view returns (bool);

    /**
     * @dev The minimum amount that should be deposited in money market before moving to next priority market
     * @param tokenAddress The address of token whose floor is being fetched
     */
    function floorMap(address tokenAddress) external view returns (uint256);

    /**
     * @dev The maximum amount that should be deposited in money market
     * @param tokenAddress The address of token whose ceiling is being fetched
     */
    function ceilingMap(address tokenAddress) external view returns (uint256);
}
