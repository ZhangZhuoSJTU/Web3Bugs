// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../libraries/Errors.sol";

abstract contract Pausable {
    bool public isPaused;

    modifier notPaused() {
        require(!isPaused, Error.CONTRACT_PAUSED);
        _;
    }

    modifier onlyAuthorizedToPause() {
        require(_isAuthorizedToPause(msg.sender), Error.UNAUTHORIZED_PAUSE);
        _;
    }

    /**
     * @notice Pause the contract.
     * @return `true` if success.
     */
    function pause() external onlyAuthorizedToPause returns (bool) {
        isPaused = true;
        return true;
    }

    /**
     * @notice Unpause the contract.
     * @return `true` if success.
     */
    function unpause() external onlyAuthorizedToPause returns (bool) {
        isPaused = false;
        return true;
    }

    /**
     * @notice Returns true if `account` is authorized to pause the contract
     * @dev This should be implemented in contracts inheriting `Pausable`
     * to provide proper access control
     */
    function _isAuthorizedToPause(address account) internal view virtual returns (bool);
}
