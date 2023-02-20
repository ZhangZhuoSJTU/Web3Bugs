// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import "../../interfaces/IProductProvider.sol";
import "../../interfaces/IFactory.sol";
import "../../utils/types/UFixed18.sol";

/**
 * @title ProductProviderLib
 * @notice Library that adds a safeguard wrapper to certain product parameters.
 * @dev Product providers are semi-untrusted as they contain custom code from the product owners. Owners
 *      have full control over this parameter-setting code, however there are some "known ranges" that
 *      a parameter cannot be outside of (i.e. a fee being over 100%).
 */
library ProductProviderLib {
    using UFixed18Lib for UFixed18;

    /**
     * @notice Returns the minimum funding fee parameter with a capped range for safety
     * @dev Caps factory.minFundingFee() <= self.minFundingFee() <= 1
     * @param self The parameter provider to operate on
     * @param factory The protocol Factory contract
     * @return Safe minimum funding fee parameter
     */
    function safeFundingFee(IProductProvider self, IFactory factory) internal view returns (UFixed18) {
        return self.fundingFee().max(factory.minFundingFee()).min(UFixed18Lib.ONE);
    }

    /**
     * @notice Returns the maker fee parameter with a capped range for safety
     * @dev Caps self.makerFee() <= 1
     * @param self The parameter provider to operate on
     * @return Safe maker fee parameter
     */
    function safeMakerFee(IProductProvider self) internal view returns (UFixed18) {
        return self.makerFee().min(UFixed18Lib.ONE);
    }

    /**
     * @notice Returns the taker fee parameter with a capped range for safety
     * @dev Caps self.takerFee() <= 1
     * @param self The parameter provider to operate on
     * @return Safe taker fee parameter
     */
    function safeTakerFee(IProductProvider self) internal view returns (UFixed18) {
        return self.takerFee().min(UFixed18Lib.ONE);
    }
}
