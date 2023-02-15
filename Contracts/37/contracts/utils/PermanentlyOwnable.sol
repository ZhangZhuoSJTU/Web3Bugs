// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";

/// A subset of OpenZeppelin's Ownable pattern, where renouncing (transfer to zero-address) is disallowed.
/// In upstream the `transferOwnership` function disallows transfer to the zero-address too.
abstract contract PermanentlyOwnable is Ownable {
    function renounceOwnership() public override onlyOwner {
        revert("Ownable: Feature disabled");
    }
}
