// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { Ownable } from "@openzeppelin/contracts-0.8/access/Ownable.sol";
import { AuraToken } from "./Aura.sol";

/**
 * @title   AuraMinter
 * @notice  Wraps the AuraToken minterMint function and protects from inflation until
 *          4 years have passed.
 * @dev     Ownership initially owned by the DAO, but likely transferred to smart contract
 *          wrapper or additional value system at some stage as directed by token holders.
 */
contract AuraMinter is Ownable {
    /// @dev Aura token
    AuraToken public immutable aura;
    /// @dev Timestamp upon which minting will be possible
    uint256 public immutable inflationProtectionTime;

    constructor(address _aura, address _dao) Ownable() {
        aura = AuraToken(_aura);
        _transferOwnership(_dao);
        inflationProtectionTime = block.timestamp + 156 weeks;
    }

    /**
     * @dev Mint function allows the owner of the contract to inflate AURA post protection time
     * @param _to Recipient address
     * @param _amount Amount of tokens
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        require(block.timestamp > inflationProtectionTime, "Inflation protected for now");
        aura.minterMint(_to, _amount);
    }
}
