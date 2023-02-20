// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "./IQuantConfig.sol";

/// @dev Current pricing status of option. Only SETTLED options can be exercised
enum PriceStatus {
    ACTIVE,
    AWAITING_SETTLEMENT_PRICE,
    SETTLED
}

/// @title Token that represents a user's long position
/// @author Rolla
/// @notice Can be used by owners to exercise their options
/// @dev Every option long position is an ERC20 token: https://eips.ethereum.org/EIPS/eip-20
interface IQToken is IERC20, IERC20Permit {
    struct QTokenInfo {
        address underlyingAsset;
        address strikeAsset;
        address oracle;
        uint256 strikePrice;
        uint256 expiryTime;
        bool isCall;
    }

    /// @notice event emitted when QTokens are minted
    /// @param account account the QToken was minted to
    /// @param amount the amount of QToken minted
    event QTokenMinted(address indexed account, uint256 amount);

    /// @notice event emitted when QTokens are burned
    /// @param account account the QToken was burned from
    /// @param amount the amount of QToken burned
    event QTokenBurned(address indexed account, uint256 amount);

    /// @notice mint option token for an account
    /// @param account account to mint token to
    /// @param amount amount to mint
    function mint(address account, uint256 amount) external;

    /// @notice burn option token from an account.
    /// @param account account to burn token from
    /// @param amount amount to burn
    function burn(address account, uint256 amount) external;

    /// @dev Address of system config.
    function quantConfig() external view returns (IQuantConfig);

    /// @dev Address of the underlying asset. WETH for ethereum options.
    function underlyingAsset() external view returns (address);

    /// @dev Address of the strike asset. Quant Web options always use USDC.
    function strikeAsset() external view returns (address);

    /// @dev Address of the oracle to be used with this option
    function oracle() external view returns (address);

    /// @dev The strike price for the token with the strike asset precision.
    function strikePrice() external view returns (uint256);

    /// @dev UNIX time for the expiry of the option
    function expiryTime() external view returns (uint256);

    /// @dev True if the option is a CALL. False if the option is a PUT.
    function isCall() external view returns (bool);

    /// @notice Get the price status of the option.
    /// @return the price status of the option. option is either active, awaiting settlement price or settled
    function getOptionPriceStatus() external view returns (PriceStatus);

    /// @notice Get the details of the QToken
    /// @return a QTokenInfo with all of the QToken parameters
    function getQTokenInfo() external view returns (QTokenInfo memory);
}
