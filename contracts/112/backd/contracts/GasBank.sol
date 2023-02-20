// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../libraries/Errors.sol";
import "../interfaces/IController.sol";
import "../interfaces/IGasBank.sol";

contract GasBank is IGasBank {
    IController public immutable controller;
    IAddressProvider public immutable addressProvider;

    /**
     * @notice Keeps track of the user balances
     */
    mapping(address => uint256) internal _balances;

    constructor(IController _controller) {
        addressProvider = _controller.addressProvider();
        controller = _controller;
    }

    /**
     * @notice Deposit `msg.value` on behalf of `account`
     */
    function depositFor(address account) external payable override {
        _balances[account] += msg.value;
        emit Deposit(account, msg.value);
    }

    /**
     * @notice Withdraws `amount` from `account`
     */
    function withdrawFrom(address account, uint256 amount) external override {
        withdrawFrom(account, payable(account), amount);
    }

    /**
     * @notice Withdraws amount not required by any action
     */
    function withdrawUnused(address account) external {
        uint256 currentBalance = _balances[account];
        require(
            msg.sender == account || addressProvider.isAction(msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        uint256 ethRequired = controller.getTotalEthRequiredForGas(account);
        if (currentBalance > ethRequired) {
            _withdrawFrom(account, payable(account), currentBalance - ethRequired, currentBalance);
        }
    }

    /**
     * @return the balance of `account`
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @notice Withdraws `amount` on behalf of `account` and send to `to`
     */
    function withdrawFrom(
        address account,
        address payable to,
        uint256 amount
    ) public override {
        uint256 currentBalance = _balances[account];
        require(currentBalance >= amount, Error.NOT_ENOUGH_FUNDS);
        require(
            msg.sender == account || addressProvider.isAction(msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );

        if (msg.sender == account) {
            uint256 ethRequired = controller.getTotalEthRequiredForGas(account);
            require(currentBalance - amount >= ethRequired, Error.NOT_ENOUGH_FUNDS);
        }
        _withdrawFrom(account, to, amount, currentBalance);
    }

    function _withdrawFrom(
        address account,
        address payable to,
        uint256 amount,
        uint256 currentBalance
    ) internal {
        _balances[account] = currentBalance - amount;

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = to.call{value: amount}("");
        require(success, Error.FAILED_TRANSFER);

        emit Withdraw(account, to, amount);
    }
}
