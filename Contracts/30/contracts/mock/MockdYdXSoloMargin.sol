// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/dYdXSoloMargin.sol";

contract MockdYdXSoloMargin is ISoloMargin {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using SafeMath for uint128;

    // Store balances as (Account => (MarketID => balance))
    mapping(address => mapping(uint256 => uint128)) balances;

    // Mapping of tokens as (MarketID => token)
    mapping(uint256 => address) tokens;

    constructor (uint256[] memory _marketIds, address[] memory _addresses) public {
        require(_marketIds.length == _addresses.length, "marketIds.length != addresses.length");
        for (uint256 i = 0; i < _marketIds.length; i++) {
            tokens[_marketIds[i]] = _addresses[i];
        }
    }

    function operate(Account.Info[] memory accounts, Actions.ActionArgs[] memory actions) public override {
        _verifyInputs(accounts, actions);

        _runActions(
            accounts,
            actions
        );
    }

    function _verifyInputs(
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions
    ) private pure {
        require(actions.length != 0, "Cannot have zero actions");
        require(accounts.length != 0, "Cannot have zero accounts");

        for (uint256 a = 0; a < accounts.length; a++) {
            for (uint256 b = a + 1; b < accounts.length; b++) {
                require(!Account.equals(accounts[a], accounts[b]), "Cannot duplicate accounts");
            }
        }
    }

    function _runActions(
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions
    ) private {
        for (uint256 i = 0; i < actions.length; i++) {
            Actions.ActionArgs memory action = actions[i];
            Actions.ActionType actionType = action.actionType;

            if (actionType == Actions.ActionType.Deposit) {
                _deposit(Actions.parseDepositArgs(accounts, action));
            } else if (actionType == Actions.ActionType.Withdraw) {
                _withdraw(Actions.parseWithdrawArgs(accounts, action));
            }
        }
    }

    function _deposit(
        Actions.DepositArgs memory args
    )
        private
    {
        require(
            args.from == msg.sender || args.from == args.account.owner,
            "Invalid deposit source"
        );

        // We'll not implement all cases in this mock, for simplicity
        require(args.amount.denomination == Types.AssetDenomination.Wei, "!Types.AssetDenomination.Wei");
        IERC20(tokens[args.market]).safeTransferFrom(args.from, address(this), args.amount.value);

        uint128 newBalance = to128(SafeMath.add(balances[args.account.owner][args.market], args.amount.value));
        balances[args.account.owner][args.market] = newBalance;
    }

    function _withdraw(
        Actions.WithdrawArgs memory args
    )
        private
    {
        require(
            msg.sender == args.account.owner,
            "Not valid operator"
        );
        require(args.amount.value <= balances[args.account.owner][args.market], "!balance");
        require(!args.amount.sign, "should receive negative amount");
        IERC20(tokens[args.market]).safeTransfer(args.to, args.amount.value);

        uint128 newBalance = to128(SafeMath.sub(balances[args.account.owner][args.market], args.amount.value));
        balances[args.account.owner][args.market] = newBalance;
    }

    function getMarketTokenAddress(uint256 marketId) external override view returns (address) {
        return tokens[marketId];
    }

    function getAccountWei(Account.Info memory account, uint256 marketId)
        external
        override
        view
        returns (Types.Wei memory)
    {
        Types.Wei memory balance = Types.Wei({
            sign: true,
            value: balances[account.owner][marketId]
        });
        return balance;
    }

    function to128(
        uint256 number
    )
        internal
        pure
        returns (uint128)
    {
        uint128 result = uint128(number);
        require(result == number, "Unsafe cast to uint128");
        return result;
    }
}
