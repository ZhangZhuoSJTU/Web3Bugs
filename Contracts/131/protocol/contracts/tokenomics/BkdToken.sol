// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../interfaces/tokenomics/IBkdToken.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/Errors.sol";

contract BkdToken is IBkdToken, ERC20 {
    using ScaledMath for uint256;

    address public immutable minter;

    constructor(
        string memory name_,
        string memory symbol_,
        address _minter
    ) ERC20(name_, symbol_) {
        minter = _minter;
    }

    /**
     * @notice Mints tokens for a given address.
     * @dev Fails if msg.sender is not the minter.
     * @param account Account for which tokens should be minted.
     * @param amount Amount of tokens to mint.
     */
    function mint(address account, uint256 amount) external override {
        require(msg.sender == minter, Error.UNAUTHORIZED_ACCESS);
        _mint(account, amount);
    }
}
