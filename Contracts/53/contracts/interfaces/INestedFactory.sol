// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../NestedReserve.sol";
import "../FeeSplitter.sol";

/// @title NestedFactory interface
interface INestedFactory {
    /// @dev Emitted when the feeSplitter is updated
    /// @param feeSplitter The new feeSplitter address
    event FeeSplitterUpdated(address feeSplitter);

    /// @dev Emitted when the reserve is updated
    /// @param reserve The new reserve address
    event ReserveUpdated(address reserve);

    /// @dev Emitted when a NFT (portfolio) is created
    /// @param nftId The NFT token Id
    /// @param originalNftId If replicated, the original NFT token Id
    event NftCreated(uint256 indexed nftId, uint256 originalNftId);

    /// @dev Emitted when a NFT (portfolio) is updated
    /// @param nftId The NFT token Id
    event NftUpdated(uint256 indexed nftId);

    /// @dev Emitted when a NFT (portfolio) is burned
    /// @param nftId The burned NFT token iI
    event NftBurned(uint256 indexed nftId);

    /// @dev Represent an order made to the factory when creating/editing an NFT
    /// @param operator The bytes32 name of the Operator
    /// @param token The expected token address in output/input
    /// @param callData The operator parameters (delegatecall)
    /// @param commit If the order is a commit (false if it's a revert)
    struct Order {
        bytes32 operator;
        address token;
        bytes callData;
        bool commit;
    }

    /// @notice Add an operator (name) for building cache
    /// @param operator The operator name to add
    function addOperator(bytes32 operator) external;

    /// @notice Remove an operator (name) for building cache
    /// @param operator The operator name to remove
    function removeOperator(bytes32 operator) external;

    /// @notice Sets the reserve where the funds are stored
    /// @param _reserve the address of the new reserve
    function setReserve(NestedReserve _reserve) external;

    /// @notice Sets the address receiving the fees
    /// @param _feeSplitter The address of the receiver
    function setFeeSplitter(FeeSplitter _feeSplitter) external;

    /// @notice Create a portfolio and store the underlying assets from the positions
    /// @param _originalTokenId The id of the NFT replicated, 0 if not replicating
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function create(
        uint256 _originalTokenId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable;

    /// @notice Add or increase one position (or more) and update the NFT
    /// @param _nftId The id of the NFT to update
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable;

    /// @notice Use the output token of an existing position from
    /// the NFT for one or more positions.
    /// @param _nftId The id of the NFT to update
    /// @param _sellToken Token used to make the orders
    /// @param _sellTokenAmount Amount of sell tokens to use
    /// @param _orders Orders calldata
    function swapTokenForTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external;

    /// @notice Use one or more existing tokens from the NFT for one position.
    /// @param _nftId The id of the NFT to update
    /// @param _buyToken The output token
    /// @param _sellTokensAmount The amount of sell tokens to use
    /// @param _orders Orders calldata
    function sellTokensToNft(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external;

    /// @notice Liquidate one or more holdings and transfer the sale amount to the user
    /// @param _nftId The id of the NFT to update
    /// @param _buyToken The output token
    /// @param _sellTokensAmount The amount of sell tokens to use
    /// @param _orders Orders calldata
    function sellTokensToWallet(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external;

    /// @notice Burn NFT and Sell all tokens for a specific ERC20 then send it back to the user
    /// @dev Will unwrap WETH output to ETH
    /// @param _nftId The id of the NFT to destroy
    /// @param _buyToken The output token
    /// @param _orders Orders calldata
    function destroy(
        uint256 _nftId,
        IERC20 _buyToken,
        Order[] calldata _orders
    ) external;

    /// @notice Withdraw a token from the reserve and transfer it to the owner without exchanging it
    /// @param _nftId NFT token ID
    /// @param _tokenIndex Index in array of tokens for this NFT and holding.
    function withdraw(uint256 _nftId, uint256 _tokenIndex) external;

    /// @notice Increase the lock timestamp of an NFT record.
    /// @param _nftId The NFT id to get the record
    /// @param _timestamp The new timestamp.
    function increaseLockTimestamp(uint256 _nftId, uint256 _timestamp) external;

    /// @notice The Factory is not storing funds, but some users can make
    /// bad manipulations and send tokens to the contract.
    /// In response to that, the owner can retrieve the factory balance of a given token
    /// to later return users funds.
    /// @param _token The token to retrieve.
    function unlockTokens(IERC20 _token) external;
}
