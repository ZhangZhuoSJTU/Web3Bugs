// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";

import "./interfaces/IPrizeFlush.sol";

/**
 * @title  PoolTogether V4 PrizeFlush
 * @author PoolTogether Inc Team
 * @notice The PrizeFlush contract helps capture interest from the PrizePool and move collected funds
           to a designated PrizeDistributor contract. When deployed, the destination, reserve and strategy
           addresses are set and used as static parameters during every "flush" execution. The parameters can be
           reset by the Owner if necessary.
 */
contract PrizeFlush is IPrizeFlush, Manageable {
    /**
     * @notice Destination address for captured interest.
     * @dev Should be set to the PrizeDistributor address.
     */
    address internal destination;

    /// @notice Reserve address.
    IReserve internal reserve;

    /// @notice Strategy address.
    IStrategy internal strategy;

    /**
     * @notice Emitted when contract has been deployed.
     * @param destination Destination address
     * @param reserve Strategy address
     * @param strategy Reserve address
     *
     */
    event Deployed(
        address indexed destination,
        IReserve indexed reserve,
        IStrategy indexed strategy
    );

    /* ============ Constructor ============ */

    /**
     * @notice Deploy Prize Flush.
     * @param _owner Prize Flush owner address
     * @param _destination Destination address
     * @param _strategy Strategy address
     * @param _reserve Reserve address
     *
     */
    constructor(
        address _owner,
        address _destination,
        IStrategy _strategy,
        IReserve _reserve
    ) Ownable(_owner) {
        _setDestination(_destination);
        _setReserve(_reserve);
        _setStrategy(_strategy);

        emit Deployed(_destination, _reserve, _strategy);
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IPrizeFlush
    function getDestination() external view override returns (address) {
        return destination;
    }

    /// @inheritdoc IPrizeFlush
    function getReserve() external view override returns (IReserve) {
        return reserve;
    }

    /// @inheritdoc IPrizeFlush
    function getStrategy() external view override returns (IStrategy) {
        return strategy;
    }

    /// @inheritdoc IPrizeFlush
    function setDestination(address _destination) external override onlyOwner returns (address) {
        _setDestination(_destination);
        emit DestinationSet(_destination);
        return _destination;
    }

    /// @inheritdoc IPrizeFlush
    function setReserve(IReserve _reserve) external override onlyOwner returns (IReserve) {
        _setReserve(_reserve);
        emit ReserveSet(_reserve);
        return _reserve;
    }

    /// @inheritdoc IPrizeFlush
    function setStrategy(IStrategy _strategy) external override onlyOwner returns (IStrategy) {
        _setStrategy(_strategy);
        emit StrategySet(_strategy);
        return _strategy;
    }

    /// @inheritdoc IPrizeFlush
    function flush() external override onlyManagerOrOwner returns (bool) {
        // Captures interest from PrizePool and distributes funds using a PrizeSplitStrategy.
        strategy.distribute();

        // After funds are distributed using PrizeSplitStrategy we EXPECT funds to be located in the Reserve.
        IReserve _reserve = reserve;
        IERC20 _token = _reserve.getToken();
        uint256 _amount = _token.balanceOf(address(_reserve));

        // IF the tokens were succesfully moved to the Reserve, now move them to the destination (PrizeDistributor) address.
        if (_amount > 0) {
            address _destination = destination;

            // Create checkpoint and transfers new total balance to PrizeDistributor
            _reserve.withdrawTo(_destination, _amount);

            emit Flushed(_destination, _amount);
            return true;
        }

        return false;
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Set global destination variable.
     * @dev `_destination` cannot be the zero address.
     * @param _destination Destination address
     */
    function _setDestination(address _destination) internal {
        require(_destination != address(0), "Flush/destination-not-zero-address");
        destination = _destination;
    }

    /**
     * @notice Set global reserve variable.
     * @dev `_reserve` cannot be the zero address.
     * @param _reserve Reserve address
     */
    function _setReserve(IReserve _reserve) internal {
        require(address(_reserve) != address(0), "Flush/reserve-not-zero-address");
        reserve = _reserve;
    }

    /**
     * @notice Set global strategy variable.
     * @dev `_strategy` cannot be the zero address.
     * @param _strategy Strategy address
     */
    function _setStrategy(IStrategy _strategy) internal {
        require(address(_strategy) != address(0), "Flush/strategy-not-zero-address");
        strategy = _strategy;
    }
}
