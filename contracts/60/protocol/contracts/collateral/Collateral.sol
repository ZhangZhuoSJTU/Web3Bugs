// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../interfaces/ICollateral.sol";
import "./types/OptimisticLedger.sol";
import "../utils/unstructured/UReentrancyGuard.sol";
import "../factory/UFactoryProvider.sol";

/**
 * @title Collateral
 * @notice Manages logic and state for all collateral accounts in the protocol.
 */
contract Collateral is ICollateral, UFactoryProvider, UReentrancyGuard {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using OptimisticLedgerLib for OptimisticLedger;

    /// @dev ERC20 stablecoin for collateral
    Token18 public token;

    /// @dev Fee on maintenance for liquidation
    UFixed18 public liquidationFee;

    /// @dev Per product collateral state
    mapping(IProduct => OptimisticLedger) private _products;

    /// @dev Protocol and product fees collected, but not yet claimed
    mapping(address => UFixed18) public fees;

    /**
     * @notice Initializes the contract state
     * @param factory_ Factory contract address
     * @param token_ Collateral ERC20 stablecoin address
     */
    function initialize(IFactory factory_, Token18 token_) external {
        UFactoryProvider__initialize(factory_);
        UReentrancyGuard__initialize();

        token = token_;
        liquidationFee = UFixed18Lib.ratio(50, 100);
    }

    /**
     * @notice Deposits `amount` collateral from `msg.sender` to `account`'s `product`
     *         account
     * @param account Account to deposit the collateral for
     * @param product Product to credit the collateral to
     * @param amount Amount of collateral to deposit
     */
    function depositTo(address account, IProduct product, UFixed18 amount)
    notPaused
    collateralInvariant(account, product)
    external {
        _products[product].creditAccount(account, amount);
        token.pull(msg.sender, amount);

        emit Deposit(account, product, amount);
    }

    /**
     * @notice Withdraws `amount` collateral from `msg.sender`'s `product` account
     *         and sends it to `account`
     * @param account Account to withdraw the collateral to
     * @param product Product to withdraw the collateral from
     * @param amount Amount of collateral to withdraw
     */
    function withdrawTo(address account, IProduct product, UFixed18 amount)
    notPaused
    collateralInvariant(msg.sender, product)
    maintenanceInvariant(msg.sender, product)
    external {
        _products[product].debitAccount(msg.sender, amount);
        token.push(account, amount);

        emit Withdrawal(msg.sender, product, amount);
    }

    /**
     * @notice Liquidates `account`'s `product` collateral account
     * @dev Account must be under-collateralized, fee returned immediately to `msg.sender`
     * @param account Account to liquidate
     * @param product Product to liquidate for
     */
    function liquidate(address account, IProduct product) notPaused nonReentrant external {
        // settle
        product.settle();
        product.settleAccount(account);

        // liquidate
        UFixed18 totalMaintenance = product.maintenance(account);
        UFixed18 totalCollateral = collateral(account, product);

        if (!totalMaintenance.gt(totalCollateral))
            revert CollateralCantLiquidate(totalMaintenance, totalCollateral);

        product.closeAll(account);

        // claim fee
        UFixed18 fee = UFixed18Lib.min(totalCollateral, totalMaintenance.mul(liquidationFee));

        _products[product].debitAccount(account, fee);
        token.push(msg.sender, fee);

        emit Liquidation(account, product, msg.sender, fee);
    }

    /**
     * @notice Credits `amount` to `account`'s collateral account
     * @dev Callable only by the corresponding product as part of the settlement flywheel.
     *      Moves collateral within a product, any collateral leaving the product due to
     *      fees has already been accounted for in the settleProduct flywheel.
     *      Debits in excess of the account balance get recorded as shortfall, and can be
     *      resolved by the product owner as needed.
     * @param account Account to credit
     * @param amount Amount to credit the account (can be negative)
     */
    function settleAccount(address account, Fixed18 amount) onlyProduct external {
        IProduct product = IProduct(msg.sender);

        UFixed18 newShortfall = _products[product].settleAccount(account, amount);

        emit AccountSettle(product, account, amount, newShortfall);
    }

    /**
     * @notice Debits `amount` from product's total collateral account
     * @dev Callable only by the corresponding product as part of the settlement flywheel
     *      Removes collateral from the product as fees.
     * @param amount Amount to debit from the account
     */
    function settleProduct(UFixed18 amount) onlyProduct external {
        IProduct product = IProduct(msg.sender);

        address protocolTreasury = factory().treasury();
        address productTreasury = factory().treasury(product);

        UFixed18 protocolFee = amount.mul(factory().fee());
        UFixed18 productFee = amount.sub(protocolFee);

        _products[product].debit(amount);
        fees[protocolTreasury] = fees[protocolTreasury].add(protocolFee);
        fees[productTreasury] = fees[productTreasury].add(productFee);

        emit ProductSettle(product, protocolFee, productFee);
    }

    /**
     * @notice Returns the balance of `account`'s `product` collateral account
     * @param account Account to return for
     * @param product Product to return for
     * @return The balance of the collateral account
     */
    function collateral(address account, IProduct product) public view returns (UFixed18) {
        return _products[product].balances[account];
    }

    /**
     * @notice Returns the total balance of `product`'s collateral
     * @param product Product to return for
     * @return The total balance of collateral in the product
     */
    function collateral(IProduct product) public view returns (UFixed18) {
        return _products[product].total;
    }

    /**
     * @notice Returns the current shortfall of `product`'s collateral
     * @param product Product to return for
     * @return The current shortfall of the product
     */
    function shortfall(IProduct product) public view returns (UFixed18) {
        return _products[product].shortfall;
    }

    /**
     * @notice Returns whether `account`'s `product` collateral account can be liquidated
     * @param account Account to return for
     * @param product Product to return for
     * @return Whether the account can be liquidated
     */
    function liquidatable(address account, IProduct product) external view returns (bool) {
        return product.maintenance(account).gt(collateral(account, product));
    }

    /**
     * @notice Returns whether `account`'s `product` collateral account can be liquidated
     *         after the next oracle version settlement
     * @dev Takes into account the current pre-position on the account
     * @param account Account to return for
     * @param product Product to return for
     * @return Whether the account can be liquidated
     */
    function liquidatableNext(address account, IProduct product) external view returns (bool) {
        return product.maintenanceNext(account).gt(collateral(account, product));
    }

    /**
     * @notice Injects additional collateral into a product to resolve shortfall
     * @dev Shortfall is a measure of settled insolvency in the market
     *      This hook can be used by the product owner or an insurance fund to re-capitalize an insolvent market
     * @param product Product to resolve shortfall for
     * @param amount Amount of shortfall to resolve
     */
    function resolveShortfall(IProduct product, UFixed18 amount) notPaused external {
        _products[product].resolve(amount);
        token.pull(msg.sender, amount);

        emit ShortfallResolution(product, amount);
    }

    /**
     * @notice Claims all of `msg.sender`'s fees
     */
    function claimFee() notPaused external {
        UFixed18 amount = fees[msg.sender];

        fees[msg.sender] = UFixed18Lib.ZERO;
        token.push(msg.sender, amount);

        emit FeeClaim(msg.sender, amount);
    }

    /**
     * @notice Updates the liquidation fee
     * @param newLiquidationFee New liquidation fee
     */
    function updateLiquidationFee(UFixed18 newLiquidationFee) onlyOwner external {
        liquidationFee = newLiquidationFee;
        emit LiquidationFeeUpdated(newLiquidationFee);
    }

    /// @dev Ensure that the user has sufficient margin for both current and next maintenance
    modifier maintenanceInvariant(address account, IProduct product) {
        _;

        UFixed18 maintenance = product.maintenance(account);
        UFixed18 maintenanceNext = product.maintenanceNext(account);

        if (UFixed18Lib.max(maintenance, maintenanceNext).gt(collateral(account, product)))
            revert CollateralInsufficientCollateralError();
    }

    /// @dev Ensure that the account is either empty or above the collateral minimum
    modifier collateralInvariant(address account, IProduct product) {
        _;

        UFixed18 accountCollateral = collateral(account, product);
        if (!accountCollateral.isZero() && accountCollateral.lt(factory().minCollateral()))
            revert CollateralUnderLimitError();
    }
}
