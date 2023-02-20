// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../../vendor/LinkToken/token/LinkERC20.sol";
import "../../vendor/LinkToken/ERC677Token.sol";

contract MockERC677 is LinkERC20, ERC677Token {

    constructor(
        string memory _name,
        string memory _symbol
    )
        public
        ERC20(_name, _symbol)
    {}

    function mint(
        address _to,
        uint256 _amount
    )
        external
    {
        _mint(_to, _amount);
    }

    function faucet(
        uint256 _amount
    )
        external
    {
        _mint(msg.sender, _amount);
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount)
        internal
        override
        virtual
        validAddress(recipient)
    {
        super._transfer(sender, recipient, amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount)
        internal
        override
        virtual
        validAddress(spender)
    {
        super._approve(owner, spender, amount);
    }


    // MODIFIERS

    modifier validAddress(address _recipient) {
        require(_recipient != address(this), "!validAddress");
        _;
    }
}
