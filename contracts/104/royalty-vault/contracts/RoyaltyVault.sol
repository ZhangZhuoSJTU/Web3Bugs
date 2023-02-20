// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {IRoyaltyVault} from "../interfaces/IRoyaltyVault.sol";
import {VaultStorage} from "./VaultStorage.sol";
import {ISplitter} from "../interfaces/ISplitter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RoyaltyVault is VaultStorage, IRoyaltyVault, ERC165, Ownable {
    /**** Events ****/
    event RoyaltySentToSplitter(address indexed splitter, uint256 amount);
    event FeeSentToPlatform(
        address indexed platformFeeRecipient,
        uint256 amount
    );
    event NewRoyaltyVaultPlatformFee(uint256 platformFee);
    event NewRoyaltyVaultPlatformFeeRecipient(address recipient);

    /**
     * @dev Getting royaltyAsset balance of Vault.
     */
    function getVaultBalance() public view override returns (uint256) {
        return IERC20(royaltyAsset).balanceOf(address(this));
    }

    /**
     * @dev Send accumulated royalty to splitter.
     */
    function sendToSplitter() external override {
        uint256 balanceOfVault = getVaultBalance();

        require(
            balanceOfVault > 0,
            "Vault does not have enough royalty Asset to send"
        );
        require(splitterProxy != address(0), "Splitter is not set");

        uint256 platformShare = (balanceOfVault * platformFee) / 10000;
        uint256 splitterShare = balanceOfVault - platformShare;

        require(
            IERC20(royaltyAsset).transfer(splitterProxy, splitterShare) == true,
            "Failed to transfer royalty Asset to splitter"
        );
        require(
            ISplitter(splitterProxy).incrementWindow(splitterShare) == true,
            "Failed to increment splitter window"
        );
        require(
            IERC20(royaltyAsset).transfer(
                platformFeeRecipient,
                platformShare
            ) == true,
            "Failed to transfer royalty Asset to platform fee recipient"
        );

        emit RoyaltySentToSplitter(splitterProxy, splitterShare);
        emit FeeSentToPlatform(platformFeeRecipient, platformShare);
    }

    /**
     * @dev Set Platform fee for collection contract.
     * @param _platformFee Platform fee in scaled percentage.
     */
    function setPlatformFee(uint256 _platformFee) external override onlyOwner {
        platformFee = _platformFee;
        emit NewRoyaltyVaultPlatformFee(_platformFee);
    }

    /**
     * @dev Set Platform fee recipient for collection.
     * @param _platformFeeRecipient Platform fee recipient address
     */
    function setPlatformFeeRecipient(address _platformFeeRecipient)
        external
        override
        onlyOwner
    {
        platformFeeRecipient = _platformFeeRecipient;
        emit NewRoyaltyVaultPlatformFeeRecipient(_platformFeeRecipient);
    }

    /**
     * @dev Get Splitter address of proxyVault.
     */
    function getSplitter() public view override returns (address) {
        return splitterProxy;
    }

    /**
     * @dev Checks for support of IRoyaltyVault.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IRoyaltyVault, ERC165)
        returns (bool)
    {
        return interfaceId == type(IRoyaltyVault).interfaceId;
    }
}
