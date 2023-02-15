// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../libraries/ScaledMath.sol";
import "../interfaces/ILpToken.sol";
import "../interfaces/pool/ILiquidityPool.sol";
import "../libraries/Errors.sol";

contract LpToken is ILpToken, ERC20Upgradeable {
    using ScaledMath for uint256;

    uint8 private _decimals;

    address public override minter;

    /**
     * @notice Make a function only callable by the minter contract.
     * @dev Fails if msg.sender is not the minter.
     */
    modifier onlyMinter() {
        require(msg.sender == minter, Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor() ERC20Upgradeable() {}

    function initialize(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        address _minter
    ) external override initializer returns (bool) {
        require(_minter != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        __ERC20_init(name_, symbol_);
        _decimals = decimals_;
        minter = _minter;
        return true;
    }

    /**
     * @notice Mint tokens.
     * @param account Account from which tokens should be burned.
     * @param amount Amount of tokens to mint.
     */
    function mint(address account, uint256 amount) external override onlyMinter {
        _mint(account, amount);
    }

    /**
     * @notice Burns tokens of msg.sender.
     * @param amount Amount of tokens to burn.
     */
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn tokens.
     * @param owner Account from which tokens should be burned.
     * @param burnAmount Amount of tokens to burn.
     * @return Amount of tokens burned.
     */
    function burn(address owner, uint256 burnAmount)
        external
        override
        onlyMinter
        returns (uint256)
    {
        _burn(owner, burnAmount);
        return burnAmount;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev We notify that LP tokens have been transferred
     * this is currently used to keep track of the withdrawal fees
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (amount > 0) ILiquidityPool(minter).handleLpTokenTransfer(from, to, amount); // add check to not break 0 transfers
    }
}
