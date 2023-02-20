// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../interfaces/IProduct.sol";
import "../interfaces/IProductProvider.sol";
import "./types/position/AccountPosition.sol";
import "./types/accumulator/AccountAccumulator.sol";
import "../utils/unstructured/UReentrancyGuard.sol";
import "../factory/UFactoryProvider.sol";

/**
 * @title Product
 * @notice Manages logic and state for a single product market.
 * @dev Cloned by the Factory contract to launch new product markets.
 */
contract Product is IProduct, UFactoryProvider, UReentrancyGuard {
    using UFixed18Lib for UFixed18;
    using Fixed18Lib for Fixed18;
    using AccumulatorLib for Accumulator;
    using PositionLib for Position;
    using PrePositionLib for PrePosition;
    using AccountAccumulatorLib for AccountAccumulator;
    using VersionedAccumulatorLib for VersionedAccumulator;
    using AccountPositionLib for AccountPosition;
    using VersionedPositionLib for VersionedPosition;

    /// @dev The parameter provider of the product market
    IProductProvider public provider;

    /// @dev The individual position state for each account
    mapping(address => AccountPosition) private _positions;

    /// @dev The global position state for the product
    VersionedPosition private _position;

    /// @dev The individual accumulator state for each account
    mapping(address => AccountAccumulator) private _accumulators;

    /// @dev The global accumulator state for the product
    VersionedAccumulator private _accumulator;

    /**
     * @notice Initializes the contract state
     * @param provider_ Product provider contract address
     */
    function initialize(IProductProvider provider_) external {
        UFactoryProvider__initialize(IFactory(msg.sender));
        UReentrancyGuard__initialize();

        provider = provider_;
    }

    /**
     * @notice Surfaces global settlement externally
     */
    function settle() nonReentrant notPaused external {
        settleInternal();
    }

    /**
     * @notice Core global settlement flywheel
     * @dev
     *  a) last settle oracle version
     *  b) latest pre position oracle version
     *  c) current oracle version
     *
     *  Settles from a->b then from b->c if either interval is non-zero to account for a change
     *  in position quantity at (b).
     *
     *  Syncs each to instantaneously after the oracle update.
     */
    function settleInternal() internal {
        provider.sync();
        factory().incentivizer().sync();

        uint256 oracleVersionPreSettle = _position.pre.oracleVersionToSettle(provider);
        uint256 oracleVersionCurrent = provider.currentVersion();
        UFixed18 accumulatedFee;

        // value a->b
        accumulatedFee = accumulatedFee.add(_accumulator.accumulate(_position, factory(), provider, oracleVersionPreSettle));

        // position a->b
        accumulatedFee = accumulatedFee.add(_position.settle(provider, oracleVersionPreSettle));

        // short-circuit if a->c
        if (oracleVersionPreSettle != oracleVersionCurrent) {

            // value b->c
            accumulatedFee = accumulatedFee.add(_accumulator.accumulate(_position, factory(), provider, oracleVersionCurrent));

            // position b->c (stamp c, does not settle pre position)
            _position.settle(provider, oracleVersionCurrent);
        }

        // settle collateral
        factory().collateral().settleProduct(accumulatedFee);

        emit Settle(oracleVersionPreSettle, oracleVersionCurrent);
    }

    /**
     * @notice Surfaces account settlement externally
     * @param account Account to settle
     */
    function settleAccount(address account) notPaused nonReentrant external {
        settleAccountInternal(account);
    }

    /**
     * @notice Core account settlement flywheel
     * @param account Account to settle
     * @dev
     *  a) last settle oracle version
     *  b) latest pre position oracle version
     *  c) current oracle version
     *
     *  Settles from a->b then from b->c if either interval is non-zero to account for a change
     *  in position quantity at (b).
     *
     *  Syncs each to instantaneously after the oracle update.
     */
    function settleAccountInternal(address account) internal {
        (IIncentivizer incentivizer, ICollateral collateral) = (factory().incentivizer(), factory().collateral());
        uint256 oracleVersionPreSettle = _positions[account].pre.oracleVersionToSettle(provider);
        uint256 oracleVersionCurrent = provider.currentVersion();
        Fixed18 accumulated;

        // value a->b
        accumulated = accumulated.add(_accumulators[account].syncTo(_accumulator, _positions[account], oracleVersionPreSettle).sum());

        // sync incentivizer before position update
        incentivizer.syncAccount(account);

        // position a->b
        accumulated = accumulated.sub(Fixed18Lib.from(_positions[account].settle(provider, oracleVersionPreSettle)));

        // short-circuit if a->c
        if (oracleVersionPreSettle != oracleVersionCurrent) {

            // value b->c
            accumulated = accumulated.add(_accumulators[account].syncTo(_accumulator, _positions[account], oracleVersionCurrent).sum());

            // position b->c (stamp c, does not settle pre position)
            _positions[account].settle(provider, oracleVersionCurrent);
        }

        // settle collateral
        collateral.settleAccount(account, accumulated);

        emit AccountSettle(account, oracleVersionPreSettle, oracleVersionCurrent);
    }

    /**
     * @notice Opens a taker position for `msg.sender`
     * @param amount Amount of the position to open
     */
    function openTake(UFixed18 amount)
    notPaused
    nonReentrant
    settleForAccount(msg.sender)
    takerInvariant
    positionInvariant
    liquidationInvariant
    maintenanceInvariant
    external {
        _positions[msg.sender].pre.openTake(provider, amount);
        _position.pre.openTake(provider, amount);

        emit TakeOpened(msg.sender, amount);
    }

    /**
     * @notice Closes a taker position for `msg.sender`
     * @param amount Amount of the position to close
     */
    function closeTake(UFixed18 amount)
    notPaused
    nonReentrant
    settleForAccount(msg.sender)
    closeInvariant
    liquidationInvariant
    external {
        closeTakeInternal(msg.sender, amount);
    }

    function closeTakeInternal(address account, UFixed18 amount) internal {
        _positions[account].pre.closeTake(provider, amount);
        _position.pre.closeTake(provider, amount);

        emit TakeClosed(account, amount);
    }

    /**
     * @notice Opens a maker position for `msg.sender`
     * @param amount Amount of the position to open
     */
    function openMake(UFixed18 amount)
    notPaused
    nonReentrant
    settleForAccount(msg.sender)
    makerInvariant
    positionInvariant
    liquidationInvariant
    maintenanceInvariant
    external {
        _positions[msg.sender].pre.openMake(provider, amount);
        _position.pre.openMake(provider, amount);

        emit MakeOpened(msg.sender, amount);
    }

    /**
     * @notice Closes a maker position for `msg.sender`
     * @param amount Amount of the position to close
     */
    function closeMake(UFixed18 amount)
    notPaused
    nonReentrant
    settleForAccount(msg.sender)
    takerInvariant
    closeInvariant
    liquidationInvariant
    external {
        closeMakeInternal(msg.sender, amount);
    }

    function closeMakeInternal(address account, UFixed18 amount) internal {
        _positions[account].pre.closeMake(provider, amount);
        _position.pre.closeMake(provider, amount);

        emit MakeClosed(account, amount);
    }

    /**
     * @notice Closes all open and pending positions, locking for liquidation
     * @dev Only callable by the Collateral contract as part of the liquidation flow
     * @param account Account to close out
     */
    function closeAll(address account) onlyCollateral settleForAccount(account) external {
        Position memory p = _positions[account].position.next(_positions[account].pre);

        // Close all positions
        closeMakeInternal(account, p.maker);
        closeTakeInternal(account, p.taker);

        // Mark liquidation to lock position
        _positions[account].liquidation = true;
    }

    /**
     * @notice Returns the maintenance requirement for `account`
     * @param account Account to return for
     * @return The current maintenance requirement
     */
    function maintenance(address account) public view returns (UFixed18) {
        return _positions[account].maintenance(provider);
    }

    /**
     * @notice Returns the maintenance requirement for `account` after next settlement
     * @dev Assumes no price change and no funding, used to protect user from over-opening
     * @param account Account to return for
     * @return The next maintenance requirement
     */
    function maintenanceNext(address account) public view returns (UFixed18) {
        return _positions[account].maintenanceNext(provider);
    }

    /**
     * @notice Returns whether `account` has a completely zero'd position
     * @param account Account to return for
     * @return The the account is closed
     */
    function isClosed(address account) external view returns (bool) {
        return _positions[account].isClosed();
    }

    /**
     * @notice Returns whether `account` is currently locked for an in-progress liquidation
     * @param account Account to return for
     * @return Whether the account is in liquidation
     */
    function isLiquidating(address account) external view returns (bool) {
        return _positions[account].liquidation;
    }

    /**
     * @notice Returns `account`'s current position
     * @param account Account to return for
     * @return Current position of the account
     */
    function position(address account) external view returns (Position memory) {
        return _positions[account].position;
    }

    /**
     * @notice Returns `account`'s current pending-settlement position
     * @param account Account to return for
     * @return Current pre-position of the account
     */
    function pre(address account) external view returns (PrePosition memory) {
        return _positions[account].pre;
    }

    /**
     * @notice Returns the global latest settled oracle version
     * @return Latest settled oracle version of the product
     */
    function latestVersion() external view returns (uint256) {
        return _position.latestVersion;
    }

    /**
     * @notice Returns the global position at oracleVersion `oracleVersion`
     * @dev Only valid for the version at which a global settlement occurred
     * @param oracleVersion Oracle version to return for
     * @return Global position at oracle version
     */
    function positionAtVersion(uint256 oracleVersion) external view returns (Position memory) {
        return _position.positionAtVersion[oracleVersion];
    }

    /**
     * @notice Returns the current global pending-settlement position
     * @return Global pending-settlement position
     */
    function pre() external view returns (PrePosition memory) {
        return _position.pre;
    }

    /**
     * @notice Returns the global accumulator value at oracleVersion `oracleVersion`
     * @dev Only valid for the version at which a global settlement occurred
     * @param oracleVersion Oracle version to return for
     * @return Global accumulator value at oracle version
     */
    function valueAtVersion(uint256 oracleVersion) external view returns (Accumulator memory) {
        return _accumulator.valueAtVersion[oracleVersion];
    }

    /**
     * @notice Returns the global accumulator share at oracleVersion `oracleVersion`
     * @dev Only valid for the version at which a global settlement occurred
     * @param oracleVersion Oracle version to return for
     * @return Global accumulator share at oracle version
     */
    function shareAtVersion(uint256 oracleVersion) external view returns (Accumulator memory) {
        return _accumulator.shareAtVersion[oracleVersion];
    }

    /**
     * @notice Returns `account`'s latest settled oracle version
     * @param account Account to return for
     * @return Latest settled oracle version of the account
     */
    function latestVersion(address account) external view returns (uint256) {
        return _accumulators[account].latestVersion;
    }

    /// @dev Limit total maker for guarded rollouts
    modifier makerInvariant {
        _;

        Position memory next = _position.position().next(_position.pre);

        if (next.maker.gt(provider.makerLimit())) revert ProductMakerOverLimitError();
    }

    /// @dev Limit maker short exposure to the range 0.0-1.0x of their position
    modifier takerInvariant {
        _;

        Position memory next = _position.position().next(_position.pre);
        UFixed18 socializationFactor = next.socializationFactor();

        if (socializationFactor.lt(UFixed18Lib.ONE)) revert ProductInsufficientLiquidityError(socializationFactor);
    }

    /// @dev Ensure that the user has only taken a maker or taker position, but not both
    modifier positionInvariant {
        _;

        if (_positions[msg.sender].isDoubleSided()) revert ProductDoubleSidedError();
    }

    /// @dev Ensure that the user hasn't closed more than is open
    modifier closeInvariant {
        _;

        if (_positions[msg.sender].isOverClosed()) revert ProductOverClosedError();
    }

    /// @dev Ensure that the user will have sufficient margin for maintenance after next settlement
    modifier maintenanceInvariant {
        _;

        if (factory().collateral().liquidatableNext(msg.sender, IProduct(this)))
            revert ProductInsufficientCollateralError();
    }

    /// @dev Ensure that the user is not currently being liquidated
    modifier liquidationInvariant {
        if (_positions[msg.sender].liquidation) revert ProductInLiquidationError();

        _;
    }

    /// @dev Helper to fully settle an account's state
    modifier settleForAccount(address account) {
        settleInternal();
        settleAccountInternal(account);

        _;
    }
}
