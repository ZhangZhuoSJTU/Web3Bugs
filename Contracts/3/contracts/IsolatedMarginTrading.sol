// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IsolatedMarginLiquidation.sol";

contract IsolatedMarginTrading is IsolatedMarginLiquidation {
    constructor(address _roles) RoleAware(_roles) Ownable() {}

    /// @dev last time this account deposited
    /// relevant for withdrawal window
    function getLastDepositBlock(address trader)
        external
        view
        returns (uint256)
    {
        return marginAccounts[trader].lastDepositBlock;
    }

    /// @dev setter for cooling off period for withdrawing funds after deposit
    function setCoolingOffPeriod(uint256 blocks) external onlyOwner {
        coolingOffPeriod = blocks;
    }

    /// @dev admin function to set leverage
    function setLeveragePercent(uint256 _leveragePercent) external onlyOwner {
        leveragePercent = _leveragePercent;
    }

    /// @dev admin function to set liquidation threshold
    function setLiquidationThresholdPercent(uint256 threshold)
        external
        onlyOwner
    {
        liquidationThresholdPercent = threshold;
    }

    /// @dev gets called by router to affirm trader taking position
    function registerPosition(
        address trader,
        uint256 borrowed,
        uint256 holdingsAdded
    ) external {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );

        IsolatedMarginAccount storage account = marginAccounts[trader];

        account.holding += holdingsAdded;
        borrow(account, borrowed);
    }

    /// @dev gets called by router to affirm unwinding of position
    function registerUnwind(
        address trader,
        uint256 extinguished,
        uint256 holdingsSold
    ) external {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );

        IsolatedMarginAccount storage account = marginAccounts[trader];

        account.holding -= holdingsSold;
        extinguishDebt(account, extinguished);
    }

    /// @dev gets called by router to close account
    function registerCloseAccount(address trader)
        external
        returns (uint256 holdingAmount)
    {
        require(
            isMarginTrader(msg.sender),
            "Calling contract not authorized to deposit"
        );

        IsolatedMarginAccount storage account = marginAccounts[trader];

        require(account.borrowed == 0, "Can't close account that's borrowing");

        holdingAmount = account.holding;

        delete marginAccounts[trader];
    }
}
