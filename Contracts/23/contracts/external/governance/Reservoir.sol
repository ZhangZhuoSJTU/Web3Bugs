// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Reservoir Contract
/// @notice Distributes a token to a different contract at a fixed rate. Though not entirely
/// necessary this contract does give some measure of safety against the Notional contract's token
/// reserves being drained by an attack. The goal should be to set up a reservoir such that the
/// Notional contract's target reserves are maintained at some reasonable level. The reservoir should
/// only ever have NOTE token balances, nothing else.
/// @dev This contract must be poked via the `drip()` function every so often.
/// @author Compound, modified by Notional
contract Reservoir {
    using SafeMath for uint256;

    /// @notice Emitted whenever the reservoir drips tokens to the target
    event ReservoirDrip(address indexed targetAddress, uint256 amountTransferred);

    /// @notice The timestamp when the Reservoir started
    uint256 public immutable DRIP_START;

    /// @notice Tokens per second that to drip to target
    uint256 public immutable DRIP_RATE;

    /// @notice Reference to token to drip
    IERC20 public immutable TOKEN;

    /// @notice Target to receive dripped tokens
    address public immutable TARGET;

    /// @notice Amount that has already been dripped
    uint256 public dripped;

    /// @notice Constructs a Reservoir
    /// @param dripRate_ Number of tokens per second to drip
    /// @param token_ The token to drip
    /// @param target_ The recipient of dripped tokens
    constructor(
        uint256 dripRate_,
        IERC20 token_,
        address target_
    ) {
        require(dripRate_ > 0, "Drip rate cannot be zero");

        DRIP_START = block.timestamp;
        DRIP_RATE = dripRate_;
        TOKEN = token_;
        TARGET = target_;
        dripped = 0;
    }

    /// @notice Drips the maximum amount of tokens to match the drip rate since inception
    /// @dev emit:Transfer
    /// @return amountToDrip tokens dripped
    function drip() public returns (uint256 amountToDrip) {
        uint256 reservoirBalance = TOKEN.balanceOf(address(this));
        require(reservoirBalance > 0, "Reservoir empty");
        uint256 blockTime = block.timestamp;

        amountToDrip = DRIP_RATE.mul(blockTime - DRIP_START).sub(dripped);
        if (amountToDrip > reservoirBalance) amountToDrip = reservoirBalance;

        // Finally, write new `dripped` value and transfer tokens to target
        dripped = dripped.add(amountToDrip);
        // No need to do special checking for return codes, here we know that the token
        // will be compliant because it is the NOTE contract
        bool success = TOKEN.transfer(TARGET, amountToDrip);
        require(success, "Transfer failed");
        emit ReservoirDrip(TARGET, amountToDrip);
    }
}
