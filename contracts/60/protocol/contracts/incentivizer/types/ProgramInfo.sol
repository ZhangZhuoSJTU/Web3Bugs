// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../../interfaces/IProduct.sol";
import "../../product/types/position/Position.sol";
import "../../product/types/accumulator/Accumulator.sol";
import "../../utils/types/Token18.sol";

struct ProgramInfo {
    /// @dev Product market contract to be incentivized
    IProduct product;

    /// @dev Amount of total maker and taker rewards
    Position amount;

    /// @dev start timestamp of the program
    uint256 start;

    /// @dev duration of the program (in seconds)
    uint256 duration;

    /// @dev grace period the program where funds can still be claimed (in seconds)
    uint256 grace;

    /// @dev Reward ERC20 token contract
    Token18 token;
}

library ProgramInfoLib {
    using UFixed18Lib for UFixed18;
    using PositionLib for Position;

    uint256 private constant MIN_DURATION = 1 days;
    uint256 private constant MAX_DURATION = 2 * 365 days;
    uint256 private constant MIN_GRACE = 7 days;
    uint256 private constant MAX_GRACE = 30 days;

    error ProgramAlreadyStartedError();
    error ProgramInvalidDurationError();
    error ProgramInvalidGraceError();

    /**
     * @notice Validates and creates a new Program
     * @param fee Global Incentivizer fee
     * @param info Un-sanitized static program information
     * @return programInfo Validated static program information with fee excluded
     * @return programFee Fee amount for the program
     */
    function create(UFixed18 fee, ProgramInfo memory info)
    internal view returns (ProgramInfo memory programInfo, UFixed18 programFee) {
        if (isStarted(info, block.timestamp)) revert ProgramAlreadyStartedError();
        if (info.duration < MIN_DURATION || info.duration > MAX_DURATION) revert ProgramInvalidDurationError();
        if (info.grace < MIN_GRACE || info.grace > MAX_GRACE) revert ProgramInvalidGraceError();

        Position memory amountAfterFee = info.amount.mul(UFixed18Lib.ONE.sub(fee));

        programInfo = ProgramInfo({
            start: info.start,
            duration: info.duration,
            grace: info.grace,

            product: info.product,
            token: info.token,
            amount: amountAfterFee
        });
        programFee = info.amount.sub(amountAfterFee).sum();
    }

    /**
     * @notice Returns the maker and taker amounts per position share
     * @param self The ProgramInfo to operate on
     * @return programFee Amounts per share
     */
    function amountPerShare(ProgramInfo memory self) internal pure returns (Accumulator memory) {
        return self.amount.div(self.duration);
    }

    /**
     * @notice Returns whether the program has started by timestamp `timestamp`
     * @param self The ProgramInfo to operate on
     * @param timestamp Timestamp to check for
     * @return Whether the program has started
     */
    function isStarted(ProgramInfo memory self, uint256 timestamp) internal pure returns (bool) {
        return timestamp >= self.start;
    }

    /**
     * @notice Returns whether the program is completed by timestamp `timestamp`
     * @param self The ProgramInfo to operate on
     * @param timestamp Timestamp to check for
     * @return Whether the program is completed
     */
    function isComplete(ProgramInfo memory self, uint256 timestamp) internal pure returns (bool) {
        return timestamp >= (self.start + self.duration);
    }
}
