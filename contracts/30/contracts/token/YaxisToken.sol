// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../vendor/LinkToken/token/LinkERC20.sol";
import "../vendor/LinkToken/ERC677Token.sol";

/**
 * @notice yAxis Token
 * @dev Contract has been copied from:
 * https://github.com/smartcontractkit/LinkToken/blob/master/contracts/v0.6/LinkToken.sol
 * with modifications only made to TOTAL_SUPPLY, NAME, SYMBOL, and the validAddress
 * modifier's revert message.
 */
contract YaxisToken is LinkERC20, ERC677Token {
    uint256 private constant TOTAL_SUPPLY = 11*10**24;
    string private constant NAME = "yAxis V2";
    string private constant SYMBOL = "YAXIS";

    constructor()
        public
        ERC20(NAME, SYMBOL)
    {
        _onCreate();
    }

    /**
     * @dev Hook that is called when this contract is created.
     * Useful to override constructor behaviour in child contracts (e.g., LINK bridge tokens).
     * @notice Default implementation mints 10**27 tokens to msg.sender
     */
    function _onCreate()
        internal
        virtual
    {
        _mint(msg.sender, TOTAL_SUPPLY);
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
