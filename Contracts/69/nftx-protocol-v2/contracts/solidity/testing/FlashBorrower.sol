// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../token/IERC20Upgradeable.sol";
import "../interface/IERC3156Upgradeable.sol";

contract FlashBorrower is IERC3156FlashBorrowerUpgradeable {
    enum Action {NORMAL, STEAL, REENTER}

    uint256 public flashBalance;
    address public flashUser;
    address public flashToken;
    uint256 public flashValue;
    uint256 public flashFee;

    /// @dev ERC-3156 Flash loan callback
    function onFlashLoan(address user, address token, uint256 value, uint256 fee, bytes calldata data) external override returns (bytes32) {
        (Action action) = abi.decode(data, (Action)); // Use this to unpack arbitrary data
        flashUser = user;
        flashToken = token;
        flashValue = value;
        flashFee = fee;
        if (action == Action.NORMAL) {
            flashBalance = IERC20Upgradeable(token).balanceOf(address(this));
            IERC20Upgradeable(token).approve(msg.sender, value + fee); // Resolve the flash loan
        } else if (action == Action.STEAL) {
            // Do nothing
        } else if (action == Action.REENTER) {
            flashBorrow(msg.sender, token, value * 2);
            IERC20Upgradeable(token).approve(msg.sender, value + fee);
        }
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function flashBorrow(address lender, address token, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.NORMAL);
        IERC3156FlashLenderUpgradeable(lender).flashLoan(IERC3156FlashBorrowerUpgradeable(address(this)), token, value, data);
    } 

    function flashBorrowAndSteal(address lender, address token, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.STEAL);
        IERC3156FlashLenderUpgradeable(lender).flashLoan(IERC3156FlashBorrowerUpgradeable(address(this)), token, value, data);
    }

    function flashBorrowAndReenter(address lender, address token, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.REENTER);
        IERC3156FlashLenderUpgradeable(lender).flashLoan(IERC3156FlashBorrowerUpgradeable(address(this)), token, value, data);
    }
}