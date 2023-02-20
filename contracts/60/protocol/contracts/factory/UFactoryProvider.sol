// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../interfaces/IFactory.sol";
import "../interfaces/IProduct.sol";

/**
 * @title UFactoryProvider
 * @notice Mix-in that manages a factory pointer and associated permissioning modifiers.
 * @dev Uses unstructured storage so that it is safe to mix-in to upgreadable contracts without modifying
 *      their storage layout.
 */
abstract contract UFactoryProvider {
    error AlreadyInitializedError();
    error NotOwnerError(address sender);
    error NotProductError(address sender);
    error NotCollateralError(address sender);
    error NotControllerOwnerError(address sender, uint256 controllerId);
    error NotProductOwnerError(address sender, IProduct product);
    error PausedError();

    /// @dev unstructured storage slot for the factory address
    bytes32 private constant FACTORY_SLOT = keccak256("equilibria.perennial.UFactoryProvider.factory");

    /**
     * @notice Initializes the contract state
     * @param factory_ Protocol Factory contract address
     */
    function UFactoryProvider__initialize(IFactory factory_) internal {
        if (address(factory()) != address(0)) revert AlreadyInitializedError();

        _setFactory(factory_);
    }

    /**
     * @notice Reads the protocol Factory contract address from unstructured state
     * @return result Protocol Factory contract address
     */
    function factory() public view virtual returns (IFactory result) {
        bytes32 slot = FACTORY_SLOT;
        assembly {
            result := sload(slot)
        }
    }

    /**
     * @notice Sets the protocol Factory contract address in unstructured state
     * @dev Internal helper
     */
    function _setFactory(IFactory newFactory) private {
        bytes32 slot = FACTORY_SLOT;
        assembly {
            sstore(slot, newFactory)
        }
    }

    /// @dev Only allow a valid product contract to call
    modifier onlyProduct {
        if (!factory().isProduct(IProduct(msg.sender))) revert NotProductError(msg.sender);

        _;
    }

    /// @dev Verify that `product` is a valid product contract
    modifier isProduct(IProduct product) {
        if (!factory().isProduct(product)) revert NotProductError(address(product));

        _;
    }

    /// @dev Only allow the Collateral contract to call
    modifier onlyCollateral {
        if (msg.sender != address(factory().collateral())) revert NotCollateralError(msg.sender);

        _;
    }

    /// @dev Only allow the protocol owner contract to call
    modifier onlyOwner() {
        if (msg.sender != factory().owner()) revert NotOwnerError(msg.sender);

        _;
    }

    /// @dev Only allow if the the protocol is currently unpaused
    modifier notPaused() {
        if (factory().isPaused()) revert PausedError();

        _;
    }
}
