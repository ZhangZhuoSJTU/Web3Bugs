// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {ICoreCollection} from "../../interfaces/ICoreCollection.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockCollection is Ownable {
    address royaltyVault;

    /**
     * @dev Set the address of the RoyaltyVaultProxy contract
     */
    function setRoyaltyVault(address _royaltyVault) external {
        royaltyVault = _royaltyVault;
    }
}
