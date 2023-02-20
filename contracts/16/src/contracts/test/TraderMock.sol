// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../Interfaces/ITracerPerpetualSwaps.sol";
import "../Interfaces/Types.sol";
import "../Interfaces/ITrader.sol";
import "../lib/LibPerpetuals.sol";
import "../lib/LibBalances.sol";

/**
 * The Trader contract is used to validate and execute off chain signed and matched orders
 */
contract TraderMock is ITrader {
    // EIP712 Constants
    // https://eips.ethereum.org/EIPS/eip-712
    string private constant EIP712_DOMAIN_NAME = "Tracer Protocol";
    string private constant EIP712_DOMAIN_VERSION = "1.0";
    bytes32 private constant EIP712_DOMAIN_SEPERATOR =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // EIP712 Types
    bytes32 private constant ORDER_TYPE =
        keccak256(
            "Order(address maker,address market,uint256 price,uint256 amount,uint256 side,uint256 expires,uint256 created)"
        );

    uint256 public constant override chainId = 1337; // Changes per chain
    bytes32 public immutable override EIP712_DOMAIN;

    // order hash to memory
    mapping(bytes32 => Perpetuals.Order) public orders;
    // maps an order hash to its signed order if seen before
    mapping(bytes32 => Types.SignedLimitOrder) public orderToSig;
    // order hash to amount filled
    mapping(bytes32 => uint256) public override filled;
    // order hash to average execution price thus far
    mapping(bytes32 => uint256) public override averageExecutionPrice;

    constructor() {
        // Construct the EIP712 Domain
        EIP712_DOMAIN = keccak256(
            abi.encode(
                EIP712_DOMAIN_SEPERATOR,
                keccak256(bytes(EIP712_DOMAIN_NAME)),
                keccak256(bytes(EIP712_DOMAIN_VERSION)),
                chainId,
                address(this)
            )
        );
    }

    function filledAmount(Perpetuals.Order memory order) external view override returns (uint256) {
        return filled[Perpetuals.orderId(order)];
    }

    function getAverageExecutionPrice(Perpetuals.Order memory order) external view override returns (uint256) {
        return averageExecutionPrice[Perpetuals.orderId(order)];
    }

    /**
     * @notice Batch executes maker and taker orders against a given market. Currently matching works
     *         by matching orders 1 to 1
     * @param makers An array of signed make orders
     * @param takers An array of signed take orders
     */
    function executeTrade(Types.SignedLimitOrder[] memory makers, Types.SignedLimitOrder[] memory takers)
        external
        override
    {
        require(makers.length == takers.length, "TDR: Lengths differ");

        // safe as we've already bounds checked the array lengths
        uint256 n = makers.length;

        require(n > 0, "TDR: Received empty arrays");

        for (uint256 i = 0; i < n; i++) {
            // verify each order individually and together
            if (!isValidPair(takers[i].order, makers[i].order)) {
                // skip if either order is invalid
                continue;
            }

            // retrieve orders
            // if the order does not exist, it is created here
            Perpetuals.Order memory makeOrder = makers[i].order;
            Perpetuals.Order memory takeOrder = takers[i].order;

            bytes32 makerOrderId = Perpetuals.orderId(makeOrder);
            bytes32 takerOrderId = Perpetuals.orderId(takeOrder);

            uint256 makeOrderFilled = filled[makerOrderId];
            uint256 takeOrderFilled = filled[takerOrderId];

            uint256 fillAmount = Balances.fillAmount(makeOrder, makeOrderFilled, takeOrder, takeOrderFilled);

            uint256 executionPrice = Perpetuals.getExecutionPrice(makeOrder, takeOrder);
            uint256 newMakeAverage = Perpetuals.calculateAverageExecutionPrice(
                makeOrderFilled,
                averageExecutionPrice[makerOrderId],
                fillAmount,
                executionPrice
            );
            uint256 newTakeAverage = Perpetuals.calculateAverageExecutionPrice(
                takeOrderFilled,
                averageExecutionPrice[takerOrderId],
                fillAmount,
                executionPrice
            );

            // match orders
            // referencing makeOrder.market is safe due to above require
            // make low level call to catch revert
            // todo this could be succeptible to re-entrancy as
            // market is never verified
            (bool success, ) = makeOrder.market.call(
                abi.encodePacked(
                    ITracerPerpetualSwaps(makeOrder.market).matchOrders.selector,
                    abi.encode(makeOrder, takeOrder, fillAmount)
                )
            );

            // ignore orders that cannot be executed
            if (!success) continue;

            // update order state
            filled[makerOrderId] = makeOrderFilled + fillAmount;
            filled[takerOrderId] = takeOrderFilled + fillAmount;
            averageExecutionPrice[makerOrderId] = newMakeAverage;
            averageExecutionPrice[takerOrderId] = newTakeAverage;
        }
    }

    function grabOrder(Types.SignedLimitOrder[] memory signedOrders, uint256 index)
        internal
        returns (Perpetuals.Order memory)
    {
        // Kept in to meet ITrader interface
    }

    function hashOrder(Perpetuals.Order memory order) public view override returns (bytes32) {
        // Kept in to meet ITrader interface
    }

    function clearFilled(Types.SignedLimitOrder memory order) external {
        filled[Perpetuals.orderId(order.order)] = 0;
    }

    /**
     * @notice Gets the EIP712 domain hash of the contract
     */
    function getDomain() external view override returns (bytes32) {
        // Kept in to meet ITrader interface
    }

    function isValidSignature(address signer, Types.SignedLimitOrder memory signedOrder) internal view returns (bool) {
        // Kept in to meet ITrader interface
    }

    function isValidPair(Perpetuals.Order memory order1, Perpetuals.Order memory order2) internal pure returns (bool) {
        return (order1.market == order2.market);
    }

    function verifySignature(address signer, Types.SignedLimitOrder memory signedOrder)
        public
        view
        override
        returns (bool)
    {
        // Kept in to meet ITrader interface
    }

    /**
     * @return An order that has been previously created in contract, given a user-supplied order
     * @dev Useful for checking to see if a supplied order has actually been created
     */
    function getOrder(Perpetuals.Order calldata order) public view override returns (Perpetuals.Order memory) {
        bytes32 orderId = Perpetuals.orderId(order);
        return orders[orderId];
    }
}
