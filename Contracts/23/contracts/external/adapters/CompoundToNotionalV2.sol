// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "interfaces/compound/CTokenInterface.sol";
import "interfaces/compound/CErc20Interface.sol";
import "interfaces/notional/NotionalProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CompoundToNotionalV2 {
    NotionalProxy public immutable NotionalV2;
    address public owner;

    constructor(NotionalProxy notionalV2_) {
        NotionalV2 = notionalV2_;
        owner = msg.sender;
    }

    function enableToken(address token, address spender) external {
        require(msg.sender == owner, "Unauthorized");
        CTokenInterface(token).approve(spender, type(uint256).max);
    }

    function migrateBorrowFromCompound(
        address cTokenBorrow,
        uint256 cTokenRepayAmount,
        uint16[] memory notionalV2CollateralIds,
        uint256[] memory notionalV2CollateralAmounts,
        BalanceActionWithTrades[] calldata borrowAction
    ) external {
        // borrow on notional via special flash loan facility
        //  - borrow repayment amount
        //  - withdraw to wallet, redeem to underlying
        // receive callback (tokens transferred to borrowing account)
        //   -> inside callback
        //   -> repayBorrowBehalf(account, repayAmount)
        //   -> deposit cToken to notional (account needs to have set approvals)
        //   -> exit callback
        // inside original borrow, check FC
        uint256 borrowBalance = CTokenInterface(cTokenBorrow).borrowBalanceCurrent(msg.sender);
        if (cTokenRepayAmount == 0) {
            // Set the entire borrow balance if it is not set
            cTokenRepayAmount = borrowBalance;
        } else {
            // Check that the cToken repayment amount is not more than required
            require(cTokenRepayAmount <= borrowBalance, "Invalid repayment amount");
        }

        bytes memory encodedData = abi.encode(
            cTokenBorrow,
            cTokenRepayAmount,
            notionalV2CollateralIds,
            notionalV2CollateralAmounts
        );
        NotionalV2.batchBalanceAndTradeActionWithCallback(msg.sender, borrowAction, encodedData);
    }

    function notionalCallback(
        address sender,
        address account,
        bytes calldata callbackData
    ) external returns (uint256) {
        require(sender == address(this), "Unauthorized callback");

        (
            address cTokenBorrow,
            uint256 cTokenRepayAmount,
            uint16[] memory notionalV2CollateralIds,
            uint256[] memory notionalV2CollateralAmounts
        ) = abi.decode(callbackData, (address, uint256, uint16[], uint256[]));

        // Transfer in the underlying amount that was borrowed
        address underlyingToken = CTokenInterface(cTokenBorrow).underlying();
        bool success = IERC20(underlyingToken).transferFrom(account, address(this), cTokenRepayAmount);
        require(success, "Transfer of repayment failed");

        // Use the amount transferred to repay the borrow
        uint code = CErc20Interface(cTokenBorrow).repayBorrowBehalf(account, cTokenRepayAmount);
        require(code == 0, "Repay borrow behalf failed");

        for (uint256 i; i < notionalV2CollateralIds.length; i++) {
            (Token memory assetToken, /* */) = NotionalV2.getCurrency(notionalV2CollateralIds[i]);
            // Transfer the collateral to this contract so we can deposit it
            success = CTokenInterface(assetToken.tokenAddress).transferFrom(account, address(this), notionalV2CollateralAmounts[i]);
            require(success, "cToken transfer failed");

            // Deposit the cToken into the account's portfolio, no free collateral check is triggered here
            NotionalV2.depositAssetToken(account, notionalV2CollateralIds[i], notionalV2CollateralAmounts[i]);
        }

        // When this exits a free collateral check will be triggered
    }

    receive() external payable {
        // This contract cannot migrate ETH loans because there is no way
        // to do transferFrom on ETH
        revert("Cannot transfer ETH");
    }
}