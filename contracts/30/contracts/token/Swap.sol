// SPDX-License-Identifier: MIT
// solhint-disable var-name-mixedcase
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IsYAX.sol";

/**
 * @title Swap
 * @notice This contract swaps a user's YAX and sYAX to the YAXIS token
 * If the user does not have YAX or sYAX, it will not attempt to swap
 * those assets in order to save gas.
 */
contract Swap {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public immutable YAXIS;
    IERC20 public immutable YAX;
    IERC20 public immutable SYAX;

    /**
     * @param _yaxis The YAXIS token address
     * @param _yax The YAX token address
     * @param _syax The sYAX token address
     */
    constructor(
        address _yaxis,
        address _yax,
        address _syax
    )
        public
    {
        YAXIS = IERC20(_yaxis);
        YAX = IERC20(_yax);
        SYAX = IERC20(_syax);
    }

    /**
     * @notice Swaps the user's YAX and sYAX for YAXIS
     * @dev Assumes this contract should never hold YAX directly
     * because it will send its entire balance to the caller.
     * @dev This contract must be funded with YAXIS before
     * users can call swap().
     */
    function swap()
        external
    {
        uint256 _balance = YAX.balanceOf(address(this));
        uint256 _amount = SYAX.balanceOf(msg.sender);
        if (_amount > 0) {
            SYAX.safeTransferFrom(msg.sender, address(this), _amount);
            IsYAX(address(SYAX)).exit();
        }
        _amount = YAX.balanceOf(msg.sender);
        if (_amount > 0) {
            YAX.safeTransferFrom(msg.sender, address(this), _amount);
        }
        _amount = YAX.balanceOf(address(this)).sub(_balance);
        if (_amount > 0) {
            YAXIS.safeTransfer(msg.sender, _amount);
        }
    }
}
