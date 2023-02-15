// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 *
 * NOTE: This contract has been extended from the Open Zeppelin library to include an
 *       unstructured storage pattern, so that it can be safely mixed in with upgradeable
 *       contracts without affecting their storage patterns through inheritance.
 */
abstract contract UOwnable {
    /**
     * @dev unstructured storage slot for the owner address
     */
    bytes32 private constant OWNER_SLOT = keccak256("equilibria.utils.UOwnable.owner");

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error UOwnableNotOwnerError(address sender);
    error UOwnableZeroAddressError();

    /**
     * @dev Initializes the contract setting the caller as the initial owner.
     */
    function UOwnable__initialize() internal {
        _setOwner(msg.sender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address result) {
        bytes32 slot = OWNER_SLOT;
        assembly {
            result := sload(slot)
        }
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        if (owner() != msg.sender) revert UOwnableNotOwnerError(msg.sender);
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert UOwnableZeroAddressError();
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner;
        bytes32 slot = OWNER_SLOT;
        assembly {
            oldOwner := sload(slot)
            sstore(slot, newOwner)
        }

        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
