// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/// @title JPEG staking contract
/// @notice Users can stake JPEG and get sJPEG back
/// @dev Every sJPEG token is backed 1:1 by JPEG
contract JPEGStaking is ERC20VotesUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);

    /// @notice The stake token, JPEG
    IERC20Upgradeable public jpeg;

    /// @param _jpeg The stake token
    function initialize(IERC20Upgradeable _jpeg) external initializer {
        __ReentrancyGuard_init();
        __ERC20_init("sJPEG", "sJPEG");
        __ERC20Permit_init("sJPEG");
        jpeg = _jpeg;
    }

    /// @notice Allows user to stake `_amount` of JPEG
    /// @dev Emits a {Stake} event
    /// @param _amount The amount of JPEG to stake
    function stake(uint256 _amount) external {
        require(_amount > 0, "invalid_amount");

        jpeg.transferFrom(msg.sender, address(this), _amount);

        _mint(msg.sender, _amount);

        emit Stake(msg.sender, _amount);
    }

    /// @notice Allows users to unstake `_amount` of JPEG
    /// @dev Emits an {Unstake} event
    /// @param _amount The amount of JPEG to unstake
    function unstake(uint256 _amount) external nonReentrant {
        require(
            _amount > 0 && _amount <= balanceOf(msg.sender),
            "invalid_amount"
        );

        _burn(msg.sender, _amount);

        jpeg.transfer(msg.sender, _amount);

        emit Unstake(msg.sender, _amount);
    }

    uint256[50] private __gap;
}
