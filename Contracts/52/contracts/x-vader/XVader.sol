// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../shared/ProtocolConstants.sol";

contract XVader is ProtocolConstants, ERC20Votes, ReentrancyGuard {
    // Address of vader token
    IERC20 public immutable vader;

    /*
     * @dev Initializes contract's state by setting vader's tokens address and
     * setting current token's name and symbol.
     **/
    constructor(IERC20 _vader)
        ERC20Permit("XVader")
        ERC20("XVader", "xVADER")
    {
        require(
            _vader != IERC20(_ZERO_ADDRESS),
            "XVader::constructor: _vader cannot be a zero address"
        );
        vader = _vader;
    }

    // Locks vader and mints xVader
    function enter(uint256 _amount) external nonReentrant {
        // Gets the amount of vader locked in the contract
        uint256 totalVader = vader.balanceOf(address(this));
        // Gets the amount of xVader in existence
        uint256 totalShares = totalSupply();

        uint256 xVADERToMint = totalShares == 0 || totalVader == 0
            // If no xVader exists, mint it 1:1 to the amount put in
            ? _amount
            // Calculate and mint the amount of xVader the vader is worth.
            // The ratio will change overtime, as xVader is burned/minted and
            // vader deposited + gained from fees / withdrawn.
            : (_amount * totalShares) / totalVader;

        _mint(msg.sender, xVADERToMint);

        // Lock the vader in the contract
        vader.transferFrom(msg.sender, address(this), _amount);
    }

    // Claim back your VADER
    // Unlocks the staked + gained vader and burns xVader
    function leave(uint256 _shares) external nonReentrant {
        // Calculates the amount of vader the xVader is worth
        uint vaderAmount = (_shares * vader.balanceOf(address(this))) / totalSupply();

        _burn(msg.sender, _shares);
        vader.transfer(msg.sender, vaderAmount);
    }
}