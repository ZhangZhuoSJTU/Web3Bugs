// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LibAsset
 * @author Connext <support@connext.network>
 * @notice This library contains helpers for dealing with onchain transfers
 *         of assets, including accounting for the native asset `assetId`
 *         conventions and any noncompliant ERC20 transfers
 */
library LibAsset {
    uint256 private constant MAX_INT = 2**256 - 1;

    /**
     * @dev All native assets use the empty address for their asset id
     *      by convention
     */
    address internal constant NATIVE_ASSETID = address(0);

    /**
     * @notice Determines whether the given assetId is the native asset
     * @param assetId The asset identifier to evaluate
     * @return Boolean indicating if the asset is the native asset
     */
    function isNativeAsset(address assetId) internal pure returns (bool) {
        return assetId == NATIVE_ASSETID;
    }

    /**
     * @notice Gets the balance of the inheriting contract for the given asset
     * @param assetId The asset identifier to get the balance of
     * @return Balance held by contracts using this library
     */
    function getOwnBalance(address assetId) internal view returns (uint256) {
        return isNativeAsset(assetId) ? address(this).balance : IERC20(assetId).balanceOf(address(this));
    }

    /**
     * @notice Transfers ether from the inheriting contract to a given
     *         recipient
     * @param recipient Address to send ether to
     * @param amount Amount to send to given recipient
     */
    function transferNativeAsset(address payable recipient, uint256 amount) internal {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "#TNA:028");
    }

    /**
     * @notice Gives approval for another address to spend tokens
     * @param assetId Token address to transfer
     * @param spender Address to give spend approval to
     * @param amount Amount to approve for spending
     */
    function approveERC20(
        IERC20 assetId,
        address spender,
        uint256 amount
    ) internal {
        if (isNativeAsset(address(assetId))) return;
        uint256 allowance = assetId.allowance(address(this), spender);
        if (allowance < amount) {
            if (allowance > 0) SafeERC20.safeApprove(IERC20(assetId), spender, 0);
            SafeERC20.safeApprove(IERC20(assetId), spender, MAX_INT);
        }
    }

    /**
     * @notice Transfers tokens from the inheriting contract to a given
     *         recipient
     * @param assetId Token address to transfer
     * @param recipient Address to send ether to
     * @param amount Amount to send to given recipient
     */
    function transferERC20(
        address assetId,
        address recipient,
        uint256 amount
    ) internal {
        SafeERC20.safeTransfer(IERC20(assetId), recipient, amount);
    }

    /**
     * @notice Transfers tokens from a sender to a given recipient
     * @param assetId Token address to transfer
     * @param from Address of sender/owner
     * @param to Address of recipient/spender
     * @param amount Amount to transfer from owner to spender
     */
    function transferFromERC20(
        address assetId,
        address from,
        address to,
        uint256 amount
    ) internal {
        SafeERC20.safeTransferFrom(IERC20(assetId), from, to, amount);
    }

    /**
     * @notice Increases the allowance of a token to a spender
     * @param assetId Token address of asset to increase allowance of
     * @param spender Account whos allowance is increased
     * @param amount Amount to increase allowance by
     */
    function increaseERC20Allowance(
        address assetId,
        address spender,
        uint256 amount
    ) internal {
        require(!isNativeAsset(assetId), "#IA:034");
        SafeERC20.safeIncreaseAllowance(IERC20(assetId), spender, amount);
    }

    /**
     * @notice Decreases the allowance of a token to a spender
     * @param assetId Token address of asset to decrease allowance of
     * @param spender Account whos allowance is decreased
     * @param amount Amount to decrease allowance by
     */
    function decreaseERC20Allowance(
        address assetId,
        address spender,
        uint256 amount
    ) internal {
        require(!isNativeAsset(assetId), "#DA:034");
        SafeERC20.safeDecreaseAllowance(IERC20(assetId), spender, amount);
    }

    /**
     * @notice Wrapper function to transfer a given asset (native or erc20) to
     *         some recipient. Should handle all non-compliant return value
     *         tokens as well by using the SafeERC20 contract by open zeppelin.
     * @param assetId Asset id for transfer (address(0) for native asset,
     *                token address for erc20s)
     * @param recipient Address to send asset to
     * @param amount Amount to send to given recipient
     */
    function transferAsset(
        address assetId,
        address payable recipient,
        uint256 amount
    ) internal {
        isNativeAsset(assetId) ? transferNativeAsset(recipient, amount) : transferERC20(assetId, recipient, amount);
    }
}
