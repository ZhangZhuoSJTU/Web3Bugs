//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import {ILivepeerToken} from "./ILivepeerToken.sol";

contract LivepeerToken is ILivepeerToken, AccessControl, ERC20Permit {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("Livepeer Token", "LPT") ERC20Permit("Livepeer Token") {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     */
    function mint(address _to, uint256 _amount)
        external
        override
        onlyRole(MINTER_ROLE)
    {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    /**
     * @dev Burns a specific amount of the sender's tokens
     * @param _amount The amount of tokens to be burned
     */
    function burn(address _from, uint256 _amount)
        external
        override
        onlyRole(BURNER_ROLE)
    {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
}
