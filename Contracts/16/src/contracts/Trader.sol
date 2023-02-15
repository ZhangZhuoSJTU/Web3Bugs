// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./Interfaces/ITracerPerpetualSwaps.sol";
import "./Interfaces/Types.sol";
import "./Interfaces/ITrader.sol";
import "./lib/LibPerpetuals.sol";
import "./lib/LibBalances.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * The Trader contract is used to validate and execute off chain signed and matched orders
 */
contract Trader is ITrader {
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
            if (
                !isValidSignature(makers[i].order.maker, makers[i]) ||
                !isValidSignature(takers[i].order.maker, takers[i]) ||
                !isValidPair(takers[i], makers[i])
            ) {
                // skip if either order is invalid
                continue;
            }

            // retrieve orders
            // if the order does not exist, it is created here
            Perpetuals.Order memory makeOrder = grabOrder(makers, i);
            Perpetuals.Order memory takeOrder = grabOrder(takers, i);

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

    /**
     * @notice Retrieves and validates an order from an order array
     * @param signedOrders an array of signed orders
     * @param index the index into the array where the desired order is
     * @return the specified order
     * @dev Should only be called with a verified signedOrder and with index
     *      < signedOrders.length
     */
    function grabOrder(Types.SignedLimitOrder[] memory signedOrders, uint256 index)
        internal
        returns (Perpetuals.Order memory)
    {
        Perpetuals.Order memory rawOrder = signedOrders[index].order;

        bytes32 orderHash = Perpetuals.orderId(rawOrder);
        // check if order exists on chain, if not, create it
        if (orders[orderHash].maker == address(0)) {
            // store this order to keep track of state
            orders[orderHash] = rawOrder;
            // map the order hash to the signed order
            orderToSig[orderHash] = signedOrders[index];
        }

        return orders[orderHash];
    }

    /**
     * @notice hashes a limit order type in order to verify signatures, per EIP712
     * @param order the limit order being hashed
     * @return an EIP712 compliant hash (with headers) of the limit order
     */
    function hashOrder(Perpetuals.Order memory order) public view override returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    EIP712_DOMAIN,
                    keccak256(
                        abi.encode(
                            ORDER_TYPE,
                            order.maker,
                            order.market,
                            order.price,
                            order.amount,
                            uint256(order.side),
                            order.expires,
                            order.created
                        )
                    )
                )
            );
    }

    /**
     * @notice Gets the EIP712 domain hash of the contract
     */
    function getDomain() external view override returns (bytes32) {
        return EIP712_DOMAIN;
    }

    /**
     * @notice Verifies a given limit order has been signed by a given signer and has a correct nonce
     * @param signer The signer who is being verified against the order
     * @param signedOrder The signed order to verify the signature of
     * @return if an order has a valid signature and a valid nonce
     * @dev does not throw if the signature is invalid.
     */
    function isValidSignature(address signer, Types.SignedLimitOrder memory signedOrder) internal view returns (bool) {
        return verifySignature(signer, signedOrder);
    }

    /**
     * @notice Validates a given pair of signed orders against each other
     * @param signedOrder1 the first signed order
     * @param signedOrder2 the second signed order
     * @return if signedOrder1 is compatible with signedOrder2
     * @dev does not throw if pairs are invalid
     */
    function isValidPair(Types.SignedLimitOrder memory signedOrder1, Types.SignedLimitOrder memory signedOrder2)
        internal
        pure
        returns (bool)
    {
        return (signedOrder1.order.market == signedOrder2.order.market);
    }

    /**
     * @notice Verifies the signature component of a signed order
     * @param signer The signer who is being verified against the order
     * @param signedOrder The unsigned order to verify the signature of
     * @return true is signer has signed the order, else false
     */
    function verifySignature(address signer, Types.SignedLimitOrder memory signedOrder)
        public
        view
        override
        returns (bool)
    {
        return
            signer == ECDSA.recover(hashOrder(signedOrder.order), signedOrder.sigV, signedOrder.sigR, signedOrder.sigS);
    }

    /**
     * @return An order that has been previously created in contract, given a user-supplied order
     * @dev Useful for checking to see if a supplied order has actually been created
     */
    function getOrder(Perpetuals.Order calldata order) external view override returns (Perpetuals.Order memory) {
        bytes32 orderId = Perpetuals.orderId(order);
        return orders[orderId];
    }
}
