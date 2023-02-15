// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/v4-core/contracts/interfaces/IReserve.sol";
import "@pooltogether/v4-core/contracts/interfaces/IStrategy.sol";

interface IPrizeFlush {
    /**
     * @notice Emit when the flush function has executed.
     * @param destination Address receiving funds
     * @param amount      Amount of tokens transferred
     */
    event Flushed(address indexed destination, uint256 amount);

    /**
     * @notice Emit when destination is set.
     * @param destination Destination address
     */
    event DestinationSet(address destination);

    /**
     * @notice Emit when strategy is set.
     * @param strategy Strategy address
     */
    event StrategySet(IStrategy strategy);

    /**
     * @notice Emit when reserve is set.
     * @param reserve Reserve address
     */
    event ReserveSet(IReserve reserve);

    /// @notice Read global destination variable.
    function getDestination() external view returns (address);

    /// @notice Read global reserve variable.
    function getReserve() external view returns (IReserve);

    /// @notice Read global strategy variable.
    function getStrategy() external view returns (IStrategy);

    /// @notice Set global destination variable.
    function setDestination(address _destination) external returns (address);

    /// @notice Set global reserve variable.
    function setReserve(IReserve _reserve) external returns (IReserve);

    /// @notice Set global strategy variable.
    function setStrategy(IStrategy _strategy) external returns (IStrategy);

    /**
     * @notice Migrate interest from PrizePool to PrizeDistributor in a single transaction.
     * @dev    Captures interest, checkpoint data and transfers tokens to final destination.
     * @return True if operation is successful.
     */
    function flush() external returns (bool);
}
