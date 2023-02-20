// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "../utils/token/ERC20Permit.sol";


contract ERC20Mock is ERC20Permit  {

    constructor(
        string memory name,
        string memory symbol
    ) ERC20Permit(name, symbol, 18) { }

    /// @dev Give tokens to whoever asks for them.
    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
