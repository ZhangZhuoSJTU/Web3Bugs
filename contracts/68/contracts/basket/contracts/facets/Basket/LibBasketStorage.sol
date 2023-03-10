// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library LibBasketStorage {
    bytes32 constant BASKET_STORAGE_POSITION =
        keccak256("diamond.standard.basket.storage");

    struct BasketStorage {
        uint256 lockBlock;
        uint256 maxCap;
        IERC20[] tokens;
        mapping(address => bool) inPool;
        uint256 entryFee;
        uint256 entryFeeBeneficiaryShare; // amount of entry fee that goes to feeBeneficiary
        uint256 exitFee;
        uint256 exitFeeBeneficiaryShare; // amount of exit fee that goes to the pool itself
        uint256 annualizedFee;
        uint256 lastAnnualizedFeeClaimed;
        address feeBeneficiary;
    }

    function basketStorage() internal pure returns (BasketStorage storage bs) {
        bytes32 position = BASKET_STORAGE_POSITION;
        assembly {
            bs.slot := position
        }
    }
}
