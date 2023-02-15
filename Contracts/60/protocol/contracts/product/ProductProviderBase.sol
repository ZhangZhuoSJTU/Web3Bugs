// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.10;

import "../interfaces/IProductProvider.sol";
import "../interfaces/IOracle.sol";

/**
 * @title ProductProviderBase
 * @notice Abstract contract that implements the oracle and payoff function portion of the product provider.
 * @dev Should be extended when implemented a new product.
 */
abstract contract ProductProviderBase is IProductProvider {
    IOracle public oracle;

    /**
     * @notice Initializes the contract state
     * @param oracle_ Oracle price provider contract address
     */
    constructor(IOracle oracle_) {
        oracle = oracle_;
    }

    /**
     * @notice Returns the payoff function given a raw oracle price
     * @param price Raw oracle price
     * @return Payoff value
     */
    function payoff(Fixed18 price) public view virtual override returns (Fixed18);

    /**
     * @notice Pass-through hook to call sync() on the oracle provider
     */
    function sync() external override {
        return oracle.sync();
    }

    /**
     * @notice Returns the payoff value at oracle version `version`
     * @param version Oracle version to return for
     * @return Payoff value at oracle version
     */
    function priceAtVersion(uint256 version) external override view returns (Fixed18) {
        return payoff(oracle.priceAtVersion(version));
    }

    /**
     * @notice Returns the timestamp at oracle version `version`
     * @param version Oracle version to return for
     * @return Timestamp at oracle version
     */
    function timestampAtVersion(uint256 version) external override view returns (uint256) {
        return oracle.timestampAtVersion(version);
    }

    /**
     * @notice Returns the current oracle version
     * @return Current oracle version
     */
    function currentVersion() external override view returns (uint256) {
        return oracle.currentVersion();
    }
}
