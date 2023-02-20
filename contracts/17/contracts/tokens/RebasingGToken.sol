// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "./GToken.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/// @notice Rebasing token implementation of the GToken.
///     This contract defines the PWRD Stablecoin (pwrd) - A yield bearing stable coin used in
///     Gro protocol. The Rebasing token does not rebase in discrete events by minting new tokens,
///     but rather relies on the GToken factor to establish the amount of tokens in circulation,
///     in a continuous manner. The token supply is defined as:
///         BASE (10**18) / factor (total supply / total assets)
///     where the total supply is the number of minted tokens, and the total assets
///     is the USD value of the underlying assets used to mint the token.
///     For simplicity the underlying amount of tokens will be refered to as base, while
///     the rebased amount (base/factor) will be refered to as rebase.
contract RebasingGToken is GToken {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event LogTransfer(address indexed sender, address indexed recipient, uint256 indexed amount);

    constructor(string memory name, string memory symbol) public GToken(name, symbol) {}

    /// @notice TotalSupply override - the totalsupply of the Rebasing token is
    ///     calculated by dividing the totalSupplyBase (standard ERC20 totalSupply)
    ///     by the factor. This result is the rebased amount
    function totalSupply() public view override returns (uint256) {
        uint256 f = factor();
        return f > 0 ? applyFactor(totalSupplyBase(), f, false) : 0;
    }

    function balanceOf(address account) public view override returns (uint256) {
        uint256 f = factor();
        return f > 0 ? applyFactor(balanceOfBase(account), f, false) : 0;
    }

    /// @notice Transfer override - Overrides the transfer method to transfer
    ///     the correct underlying base amount of tokens, but emit the rebased amount
    /// @param recipient Recipient of transfer
    /// @param amount Base amount to transfer
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        uint256 transferAmount = applyFactor(amount, factor(), true);
        // amount.mul(factor()).div(BASE);
        super._transfer(msg.sender, recipient, transferAmount, amount);
        emit LogTransfer(msg.sender, recipient, amount);
        return true;
    }

    /// @notice Price should always be 1E18
    function getPricePerShare() external view override returns (uint256) {
        return BASE;
    }

    function getShareAssets(uint256 shares) external view override returns (uint256) {
        return shares;
    }

    function getAssets(address account) external view override returns (uint256) {
        return balanceOf(account);
    }

    /// @notice Mint RebasingGTokens
    /// @param account Target account
    /// @param _factor Factor to use for mint
    /// @param amount Mint amount in USD
    function mint(
        address account,
        uint256 _factor,
        uint256 amount
    ) external override onlyWhitelist {
        require(account != address(0), "mint: 0x");
        require(amount > 0, "Amount is zero.");
        // Apply factor to amount to get rebase amount
        uint256 mintAmount = applyFactor(amount, _factor, true);
        // uint256 mintAmount = amount.mul(_factor).div(BASE);
        _mint(account, mintAmount, amount);
    }

    /// @notice Burn RebasingGTokens
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
        // Apply factor to amount to get rebase amount
        uint256 burnAmount = applyFactor(amount, _factor, true);
        // uint256 burnAmount = amount.mul(_factor).div(BASE);
        _burn(account, burnAmount, amount);
    }

    /// @notice Burn all pwrds for account - used by withdraw all methods
    /// @param account Target account
    function burnAll(address account) external override onlyWhitelist {
        require(account != address(0), "burnAll: 0x");
        uint256 burnAmount = balanceOfBase(account);
        uint256 amount = applyFactor(burnAmount, factor(), false);
        // uint256 amount = burnAmount.mul(BASE).div(factor());
        // Apply factor to amount to get rebase amount
        _burn(account, burnAmount, amount);
    }

    /// @notice transferFrom override - Overrides the transferFrom method
    ///     to transfer the correct amount of underlying tokens (Base amount)
    ///     but emit the rebased amount
    /// @param sender Sender of transfer
    /// @param recipient Reciepient of transfer
    /// @param amount Mint amount in USD
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        super._decreaseApproved(sender, msg.sender, amount);
        uint256 transferAmount = applyFactor(amount, factor(), true);
        // amount.mul(factor()).div(BASE)
        super._transfer(sender, recipient, transferAmount, amount);
        return true;
    }
}
