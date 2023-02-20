//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import {ProxyVault} from "./ProxyVault.sol";
import {IRoyaltyVault} from "../interfaces/IRoyaltyVault.sol";

contract RoyaltyVaultFactory {
    /**** Immutable data ****/
    address public immutable royaltyVault;

    /**** Mutable data ****/
    address public royaltyAsset;
    address public splitterProxy;
    uint256 public platformFee;
    address public platformFeeRecipient;

    /**** Events ****/

    event VaultCreated(address vault);

    /**
     * @dev Constructor
     * @param _royaltyVault address of the RoyaltyVault logic contract
     */
    constructor(address _royaltyVault) {
        royaltyVault = _royaltyVault;
        platformFee = 500; // 5%
        platformFeeRecipient = 0x70388C130222eae55a0527a2367486bF5D12d6e7;
    }

    /**
     * @dev Create RoyaltyVault
     * @param _splitter address of the splitter contract.
     * @param _royaltyAsset address of the assets which will be splitted.
     */

    function createVault(address _splitter, address _royaltyAsset)
        external
        returns (address vault)
    {
        splitterProxy = _splitter;
        royaltyAsset = _royaltyAsset;

        vault = address(
            new ProxyVault{salt: keccak256(abi.encode(_splitter))}()
        );

        delete splitterProxy;
        delete royaltyAsset;
    }

    /**
     * @dev Set Platform fee for collection contract.
     * @param _platformFee Platform fee in scaled percentage. (5% = 200)
     * @param _vault vault address.
     */
    function setPlatformFee(address _vault, uint256 _platformFee) external {
        IRoyaltyVault(_vault).setPlatformFee(_platformFee);
    }

    /**
     * @dev Set Platform fee recipient for collection contract.
     * @param _vault vault address.
     * @param _platformFeeRecipient Platform fee recipient.
     */
    function setPlatformFeeRecipient(
        address _vault,
        address _platformFeeRecipient
    ) external {
        require(_vault != address(0), "Invalid vault");
        require(
            _platformFeeRecipient != address(0),
            "Invalid platform fee recipient"
        );
        IRoyaltyVault(_vault).setPlatformFeeRecipient(_platformFeeRecipient);
    }
}
