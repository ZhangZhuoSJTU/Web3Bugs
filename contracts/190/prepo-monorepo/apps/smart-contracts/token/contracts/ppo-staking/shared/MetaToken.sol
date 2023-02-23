// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {GovernedMinterRole} from "./GovernedMinterRole.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title  MintableToken
 * @author mStable
 */
contract MintableToken is ERC20, GovernedMinterRole, ERC20Burnable {
  constructor(address _nexus, address _initialRecipient)
    ERC20("Meta", "MTA")
    GovernedMinterRole(_nexus)
  {
    // 100m initial supply
    _mint(_initialRecipient, 100000000 * (10**18));
  }

  /**
   * @dev See {ERC20-_mint}.
   *
   * Requirements:
   *
   * - the caller must have the {MinterRole}.
   */
  function mint(address account, uint256 amount)
    public
    onlyMinter
    returns (bool)
  {
    _mint(account, amount);
    return true;
  }
}
