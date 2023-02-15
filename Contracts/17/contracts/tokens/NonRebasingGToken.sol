// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./GToken.sol";

/// @notice NonRebasing token implementation of the GToken.
///     This contract defines the Gro Vault Token (GVT) - A yield baring token used in
///     gro protocol. The NonRebasing token has a fluctuating price, defined as:
///         BASE (10**18) / factor (total supply / total assets)
///     where the total supply is the number of minted tokens, and the total assets
///     is the USD value of the underlying assets used to mint the token.
contract NonRebasingGToken is GToken {
    uint256 public constant INIT_BASE = 3333333333333333;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event LogTransfer(address indexed sender, address indexed recipient, uint256 indexed amount, uint256 factor);

    constructor(string memory name, string memory symbol) public GToken(name, symbol) {}

    /// @notice Return the base supply of the token - This is similar
    ///     to the original ERC20 totalSupply method for NonRebasingGTokens
    function totalSupply() public view override returns (uint256) {
        return totalSupplyBase();
    }

    /// @notice Amount of token the user owns
    function balanceOf(address account) public view override returns (uint256) {
        return balanceOfBase(account);
    }

    /// @notice Transfer override - does the same thing as the standard
    ///     ERC20 transfer function (shows number of tokens transfered)
    /// @param recipient Recipient of transfer
    /// @param amount Amount to transfer
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        super._transfer(msg.sender, recipient, amount, amount);
        emit LogTransfer(msg.sender, recipient, amount, factor());
        return true;
    }

    /// @notice Price per token (USD)
    function getPricePerShare() public view override returns (uint256) {
        uint256 f = factor();
        return f > 0 ? applyFactor(BASE, f, false) : 0;
    }

    /// @notice Price of a set amount of shared
    /// @param shares Number of shares
    function getShareAssets(uint256 shares) public view override returns (uint256) {
        return applyFactor(shares, getPricePerShare(), true);
    }

    /// @notice Get amount USD value of users assets
    /// @param account Target account
    function getAssets(address account) external view override returns (uint256) {
        return getShareAssets(balanceOf(account));
    }

    function getInitialBase() internal pure override returns (uint256) {
        return INIT_BASE;
    }

    /// @notice Mint NonRebasingGTokens
    /// @param account Target account
    /// @param _factor factor to use for mint
    /// @param amount Mint amount in USD
    function mint(
        address account,
        uint256 _factor,
        uint256 amount
    ) external override onlyWhitelist {
        require(account != address(0), "mint: 0x");
        require(amount > 0, "Amount is zero.");
        // Divide USD amount by factor to get number of tokens to mint
        amount = applyFactor(amount, _factor, true);
        _mint(account, amount, amount);
    }

    /// @notice Burn NonRebasingGTokens
    /// @param account Target account
    /// @param _factor Factor to use for mint
    /// @param amount Burn amount in USD
    function burn(
        address account,
        uint256 _factor,
        uint256 amount
    ) external override onlyWhitelist {
        require(account != address(0), "burn: 0x");
        require(amount > 0, "Amount is zero.");
        // Divide USD amount by factor to get number of tokens to burn
        amount = applyFactor(amount, _factor, true);
        _burn(account, amount, amount);
    }

    /// @notice Burn all tokens for user (used by withdraw all methods to avoid dust)
    /// @param account Target account
    function burnAll(address account) external override onlyWhitelist {
        require(account != address(0), "burnAll: 0x");
        uint256 amount = balanceOfBase(account);
        _burn(account, amount, amount);
    }
}
