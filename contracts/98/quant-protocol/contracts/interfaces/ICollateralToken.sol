// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IQuantConfig.sol";
import "./IQToken.sol";

/// @title Tokens representing a Quant user's short positions
/// @author Rolla
/// @notice Can be used by owners to claim their collateral
interface ICollateralToken is IERC1155 {
    struct QTokensDetails {
        address underlyingAsset;
        address strikeAsset;
        address oracle;
        uint256 shortStrikePrice;
        uint256 longStrikePrice;
        uint256 expiryTime;
        bool isCall;
    }

    /// @notice event emitted when a new CollateralToken is created
    /// @param qTokenAddress address of the corresponding QToken
    /// @param qTokenAsCollateral QToken address of an option used as collateral in a spread
    /// @param id unique id of the created CollateralToken
    /// @param allCollateralTokensLength the updated number of already created CollateralTokens
    event CollateralTokenCreated(
        address indexed qTokenAddress,
        address qTokenAsCollateral,
        uint256 id,
        uint256 allCollateralTokensLength
    );

    /// @notice event emitted when CollateralTokens are minted
    /// @param recipient address that received the minted CollateralTokens
    /// @param id unique id of the minted CollateralToken
    /// @param amount the amount of CollateralToken minted
    event CollateralTokenMinted(
        address indexed recipient,
        uint256 indexed id,
        uint256 amount
    );

    /// @notice event emitted when CollateralTokens are burned
    /// @param owner address that the CollateralToken was burned from
    /// @param id unique id of the burned CollateralToken
    /// @param amount the amount of CollateralToken burned
    event CollateralTokenBurned(
        address indexed owner,
        uint256 indexed id,
        uint256 amount
    );

    /// @notice Create new CollateralTokens
    /// @param _qTokenAddress address of the corresponding QToken
    /// @param _qTokenAsCollateral QToken address of an option used as collateral in a spread
    /// @return id the id for the CollateralToken created with the given arguments
    function createCollateralToken(
        address _qTokenAddress,
        address _qTokenAsCollateral
    ) external returns (uint256 id);

    /// @notice Mint CollateralTokens for a given account
    /// @param recipient address to receive the minted tokens
    /// @param amount amount of tokens to mint
    /// @param collateralTokenId id of the token to be minted
    function mintCollateralToken(
        address recipient,
        uint256 collateralTokenId,
        uint256 amount
    ) external;

    /// @notice Mint CollateralTokens for a given account
    /// @param owner address to burn tokens from
    /// @param amount amount of tokens to burn
    /// @param collateralTokenId id of the token to be burned
    function burnCollateralToken(
        address owner,
        uint256 collateralTokenId,
        uint256 amount
    ) external;

    /// @notice Batched minting of multiple CollateralTokens for a given account
    /// @dev Should be used when minting multiple CollateralTokens for a single user,
    /// i.e., when a user buys more than one short position through the interface
    /// @param recipient address to receive the minted tokens
    /// @param ids array of CollateralToken ids to be minted
    /// @param amounts array of amounts of tokens to be minted
    /// @dev ids and amounts must have the same length
    function mintCollateralTokenBatch(
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external;

    /// @notice Batched burning of multiple CollateralTokens from a given account
    /// @dev Should be used when burning multiple CollateralTokens for a single user,
    /// i.e., when a user sells more than one short position through the interface
    /// @param owner address to burn tokens from
    /// @param ids array of CollateralToken ids to be burned
    /// @param amounts array of amounts of tokens to be burned
    /// @dev ids and amounts shoud have the same length
    function burnCollateralTokenBatch(
        address owner,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external;

    /// @notice Set approval for all IDs by providing parameters to setApprovalForAll
    /// alongside a valid signature (r, s, v)
    /// @dev This method is implemented by following EIP-712: https://eips.ethereum.org/EIPS/eip-712
    /// @param owner     Address that wants to set operator status
    /// @param operator  Address to add to the set of authorized operators
    /// @param approved  True if the operator is approved, false to revoke approval
    /// @param nonce     Nonce valid for the owner at the time of the meta-tx execution
    /// @param deadline  Maximum unix timestamp at which the signature is still valid
    /// @param v         Last byte of the signed data
    /// @param r         The first 64 bytes of the signed data
    /// @param s         Bytes 64…128 of the signed data
    function metaSetApprovalForAll(
        address owner,
        address operator,
        bool approved,
        uint256 nonce,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice The Quant system config
    function quantConfig() external view returns (IQuantConfig);

    /// @notice mapping of CollateralToken ids to their respective info struct
    function idToInfo(uint256) external view returns (address, address);

    /// @notice array of all the created CollateralToken ids
    function collateralTokenIds(uint256) external view returns (uint256);

    /// @notice get the total amount of collateral tokens created
    function getCollateralTokensLength() external view returns (uint256);

    /// @notice get the details of the QTokens related to a given CollateralToken id
    function getCollateralTokenInfo(uint256 id)
        external
        view
        returns (QTokensDetails memory);

    /// @notice Returns a unique CollateralToken id based on its parameters
    /// @param _qToken the address of the corresponding QToken
    /// @param _qTokenAsCollateral QToken address of an option used as collateral in a spread
    /// @return id the id for the CollateralToken with the given arguments
    function getCollateralTokenId(address _qToken, address _qTokenAsCollateral)
        external
        pure
        returns (uint256 id);
}
