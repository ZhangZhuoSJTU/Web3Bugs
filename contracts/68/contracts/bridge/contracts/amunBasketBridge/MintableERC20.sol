// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import {ERC20Upgradeable, ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

contract MintableERC20 is ERC20PermitUpgradeable {
    address public predicateProxy;

    bool private recovered;
    bool private burned;

    function initialize(
        string memory name_,
        string memory symbol_,
        address predicateProxy_
    ) public initializer {
        require(
            predicateProxy_ != address(0),
            "new predicateProxy is the zero address"
        );
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        predicateProxy = predicateProxy_;
    }

    function mint(address account, uint256 amount) external {
        require(msg.sender == predicateProxy, "ONLY_PREDICATE_PROXY");
        _mint(account, amount);
    }

}
