pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

/// @title AavePropositionPower
/// @author Aave
/// @notice Asset to control the permissions on the actions in AaveProtoGovernance, like:
///  - Register a new Proposal
contract AavePropositionPower is ERC20Capped, ERC20Detailed {

    /// @notice Constructor
    /// @param name Asset name
    /// @param symbol Asset symbol
    /// @param decimals Asset decimals
    /// @param council List of addresses which will receive tokens initially
    /// @param cap The cap of tokens to mint, length of the council list
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address[] memory council,
        uint256 cap
    )
    public ERC20Capped(cap * 1 ether) ERC20Detailed(name, symbol, decimals) {
        require(cap == council.length, "INCONSISTENT_CAP_AND_COUNCIL_SIZE");
        for (uint256 i = 0; i < cap; i++) {
            _mint(council[i], 1 ether);
        }
    }
}