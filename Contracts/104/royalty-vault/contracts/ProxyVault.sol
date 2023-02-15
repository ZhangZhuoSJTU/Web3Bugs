// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {VaultStorage} from "./VaultStorage.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProxyVault is VaultStorage, Ownable {
    address internal royaltyVault;

    /**
     *  @dev This is the constructor of the ProxyVault contract.
     *  It is called when the ProxyVault is created.
     *  It sets the variable royaltyVault to the address of the RoyaltyVault contract.
     */
    constructor() {
        royaltyVault = IVaultFactory(msg.sender).royaltyVault();
        splitterProxy = IVaultFactory(msg.sender).splitterProxy();
        royaltyAsset = IVaultFactory(msg.sender).royaltyAsset();
        platformFee = IVaultFactory(msg.sender).platformFee();
        platformFeeRecipient = IVaultFactory(msg.sender).platformFeeRecipient();
    }

    /**
     *  @dev This function is called when the ProxyVault is called, it points to the RoyaltyVault contract.
     */

    fallback() external payable {
        address _impl = royaltyVault;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)

            switch result
            case 0 {
                revert(ptr, size)
            }
            default {
                return(ptr, size)
            }
        }
    }

    receive() external payable {}
}
