// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../../interfaces/actions/topup/ITopUpHandler.sol";

contract MockTopUpHandler is ITopUpHandler, Initializable {
    using SafeERC20 for IERC20;

    MockUserFactors public immutable userFactors;

    constructor() {
        userFactors = new MockUserFactors();
    }

    /**
     * @dev Executes the top-up of a position, in this case, just send money back to the user
     */
    function topUp(
        bytes32 account,
        address underlying,
        uint256 amount,
        bytes memory /* extra */
    ) external payable override returns (bool) {
        address addr = address(bytes20(account));
        if (underlying == address(0)) {
            payable(addr).transfer(amount);
        } else {
            IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(underlying).safeApprove(addr, amount);
            IERC20(underlying).safeTransfer(addr, amount);
        }

        userFactors.increaseUserFactor(addr);

        return true;
    }

    function getUserFactor(bytes32 account, bytes memory) external view override returns (uint256) {
        require(address(userFactors) != address(0), "user factors not set");
        address addr = address(bytes20(account));
        return userFactors.getUserFactor(addr);
    }
}

contract MockUserFactors {
    /**
     * @dev all users start with `_DEFAULT_USER_FACTOR` and their position is
     * increased by `_INCREMENT_USER_FACTOR` when they are topped up
     */
    uint256 internal constant _DEFAULT_USER_FACTOR = 1.3e18;
    uint256 internal constant _INCREMENT_USER_FACTOR = 0.3e18;

    mapping(address => uint256) internal _userFactors;

    function increaseUserFactor(address account) external {
        // NOTE: add _INCREMENT_USER_FACTOR to the current user factor to be able
        // to simulate topping up actually increasing the current factor
        uint256 userFactor = _userFactors[account];
        if (userFactor == 0) {
            userFactor = _DEFAULT_USER_FACTOR;
        }
        _userFactors[account] = userFactor + _INCREMENT_USER_FACTOR;
    }

    function getUserFactor(address account) external view returns (uint256) {
        uint256 userFactor = _userFactors[account];
        return userFactor == 0 ? _DEFAULT_USER_FACTOR : userFactor;
    }
}
