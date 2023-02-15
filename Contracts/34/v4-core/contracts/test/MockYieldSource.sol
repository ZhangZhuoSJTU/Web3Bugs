// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";

import "./ERC20Mintable.sol";

/**
 * @dev Extension of {ERC20} that adds a set of accounts with the {MinterRole},
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract MockYieldSource is ERC20, IYieldSource {
    ERC20Mintable token;

    constructor(string memory _name, string memory _symbol) ERC20("YIELD", "YLD") {
        token = new ERC20Mintable(_name, _symbol);
    }

    function yield(uint256 amount) external {
        token.mint(address(this), amount);
    }

    /// @notice Returns the ERC20 asset token used for deposits.
    /// @return The ERC20 asset token address.
    function depositToken() external view override returns (address) {
        return address(token);
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens.
    function balanceOfToken(address addr) external view override returns (uint256) {
        return sharesToTokens(balanceOf(addr));
    }

    /// @notice Supplies tokens to the yield source.  Allows assets to be supplied on other user's behalf using the `to` param.
    /// @param amount The amount of asset tokens to be supplied.  Denominated in `depositToken()` as above.
    /// @param to The user whose balance will receive the tokens
    function supplyTokenTo(uint256 amount, address to) external override {
        uint256 shares = tokensToShares(amount);
        token.transferFrom(msg.sender, address(this), amount);
        _mint(to, shares);
    }

    /// @notice Redeems tokens from the yield source.
    /// @param amount The amount of asset tokens to withdraw.  Denominated in `depositToken()` as above.
    /// @return The actual amount of interst bearing tokens that were redeemed.
    function redeemToken(uint256 amount) external override returns (uint256) {
        uint256 shares = tokensToShares(amount);
        _burn(msg.sender, shares);
        token.transfer(msg.sender, amount);

        return amount;
    }

    function tokensToShares(uint256 tokens) public view returns (uint256) {
        uint256 tokenBalance = token.balanceOf(address(this));

        if (tokenBalance == 0) {
            return tokens;
        } else {
            return (tokens * totalSupply()) / tokenBalance;
        }
    }

    function sharesToTokens(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();

        if (supply == 0) {
            return shares;
        } else {
            return (shares * token.balanceOf(address(this))) / supply;
        }
    }
}
