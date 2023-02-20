// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./IMultiRateLimited.sol";

/// @notice global contract to handle rate limited minting of VOLT on a global level
/// allows whitelisted minters to call in and specify the address to mint VOLT to within
/// the calling contract's limits
interface IGlobalRateLimitedMinter is IMultiRateLimited {
    /// @notice function that all VOLT minters call to mint VOLT
    /// pausable and depletes the msg.sender's buffer
    /// @param to the recipient address of the minted VOLT
    /// @param amount the amount of VOLT to mint
    function mintVolt(address to, uint256 amount) external;

    /// @notice mint VOLT to the target address and deplete the whole rate limited
    ///  minter's buffer, pausable and completely depletes the msg.sender's buffer
    /// @param to the recipient address of the minted VOLT
    /// mints all VOLT that msg.sender has in the buffer
    function mintMaxAllowableVolt(address to) external;
}
