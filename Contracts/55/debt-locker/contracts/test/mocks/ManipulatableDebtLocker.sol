// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { IMapleLoanLike } from "../../interfaces/Interfaces.sol";

import { DebtLocker } from "../../DebtLocker.sol";

contract ManipulatableDebtLocker is DebtLocker {

    bytes32 constant FACTORY_SLOT = bytes32(0x7a45a402e4cb6e08ebc196f20f66d5d30e67285a2a8aa80503fa409e727a4af1);

    constructor(address loan_, address pool_, address factory_) public {
        _loan = loan_;
        _pool = pool_;

        _principalRemainingAtLastClaim = IMapleLoanLike(loan_).principalRequested();

        setFactory(factory_);
    }

    /**************************************/
    /*** Storage Manipulation Functions ***/
    /**************************************/

    function setFactory(address factory_) public {
        _setSlotValue(FACTORY_SLOT, bytes32(uint256(uint160(factory_))));
    }

    function setPool(address pool_) external {
        _pool = pool_;
    }

}
