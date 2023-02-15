// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "../libraries/Errors.sol";
import "./access/Authorization.sol";
import "../interfaces/ISwapperRegistry.sol";

contract SwapperRegistry is ISwapperRegistry, Authorization {
    mapping(address => address[]) private _swappableTokens;
    mapping(address => mapping(address => address)) private _swapperImplementations;

    event NewSwapper(address fromToken, address toToken, address newSwapper);
    event SwapperRemoved(address fromToken, address toToken, address oldSwapper);
    event NewSwappablePair(address fromToken, address toToken);

    constructor(IRoleManager roleManager) Authorization(roleManager) {}

    /**
     * @notice Add new swapper implementation for a given token pair.
     * @param fromToken Address of token to swap.
     * @param toToken Address of token to receive.
     * @param newSwapper Address of new swapper implementation for the token pair.
     * @return True if the swapper was successfully set for the token pair.
     */
    function registerSwapper(
        address fromToken,
        address toToken,
        address newSwapper
    ) external onlyGovernance returns (bool) {
        require(
            fromToken != toToken &&
                fromToken != address(0) &&
                toToken != address(0) &&
                newSwapper != address(0),
            Error.INVALID_TOKEN_PAIR
        );
        address swapper = _swapperImplementations[fromToken][toToken];
        if (swapper != address(0)) {
            if (swapper == newSwapper) return false;
            emit SwapperRemoved(fromToken, toToken, swapper);
        } else {
            _swappableTokens[fromToken].push(toToken);
            emit NewSwappablePair(fromToken, toToken);
        }
        _swapperImplementations[fromToken][toToken] = newSwapper;
        emit NewSwapper(fromToken, toToken, newSwapper);
        return true;
    }

    /**
     * @notice Get swapper implementation for a given token pair.
     * @param fromToken Address of token to swap.
     * @param toToken Address of token to receive.
     * @return Address of swapper for token pair. Returns zero address if no swapper implementation exists.
     */
    function getSwapper(address fromToken, address toToken)
        external
        view
        override
        returns (address)
    {
        return _swapperImplementations[fromToken][toToken];
    }

    /**
     * @notice Check if a swapper implementation exists for a given token pair.
     * @param fromToken Address of token to swap.
     * @param toToken Address of token to receive.
     * @return True if a swapper exists for the token pair.
     */
    function swapperExists(address fromToken, address toToken)
        external
        view
        override
        returns (bool)
    {
        return _swapperImplementations[fromToken][toToken] != address(0) ? true : false;
    }

    function getAllSwappableTokens(address token)
        external
        view
        override
        returns (address[] memory)
    {
        return _swappableTokens[token];
    }
}
