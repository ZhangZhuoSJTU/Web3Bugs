//SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../../CreditLine/CreditLine.sol';
import '../Helpers/CLConstants.sol';

contract CLUser {
    function createRequest(address creditLineAddress, CLConstants.RequestParams memory requestData) public returns (uint256) {
        CreditLine creditLine = CreditLine(creditLineAddress);

        uint256 _id = creditLine.request(
            requestData.requestTo,
            requestData.borrowLimit,
            requestData.borrowRate,
            requestData.autoLiquidation,
            requestData.collateralRatio,
            requestData.borrowAsset,
            requestData.borrowAssetStrategy,
            requestData.collateralAsset,
            requestData.collateralStrategy,
            requestData.requestAsLender
        );

        return _id;
    }

    function cancelRequest(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.cancel(id);
    }

    function acceptRequest(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.accept(id);
    }

    function borrow(
        address creditLineAddress,
        uint256 id,
        uint256 amount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.borrow(id, amount);
    }

    function repay(
        address creditLineAddress,
        uint256 id,
        uint256 amount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.repay(id, amount);
    }

    function addCollateral(
        address creditLineAddress,
        uint256 id,
        uint256 amount,
        bool fromSavingsAccount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.depositCollateral(id, amount, fromSavingsAccount);
    }

    function withdrawCollateral(
        address creditLineAddress,
        uint256 id,
        uint256 amount,
        bool toSavingsAccount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.withdrawCollateral(id, amount, toSavingsAccount);
    }

    function withdrawAllCollateral(
        address creditLineAddress,
        uint256 id,
        bool toSavingsAccount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.withdrawAllCollateral(id, toSavingsAccount);
    }

    function updateBorrowLimit(
        address creditLineAddress,
        uint256 id,
        uint128 newBorrowLimit
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.updateBorrowLimit(id, newBorrowLimit);
    }

    function close(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.close(id);
    }

    function liquidate(
        address creditLineAddress,
        uint256 id,
        bool toSavingsAccount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.liquidate(id, toSavingsAccount);
    }

    function setAllowance(
        address spender,
        address token,
        uint256 amount
    ) public {
        IERC20(token).approve(spender, amount);
    }

    function setAllowanceForSavingsAccount(
        address savingsAccount,
        address token,
        address spender,
        uint256 amount
    ) public {
        ISavingsAccount SavingsAccount = ISavingsAccount(savingsAccount);

        SavingsAccount.approve(token, spender, amount);
    }

    function savingsAccountDeposit(
        address savingsAccount,
        address token,
        address strategy,
        address to,
        uint256 amount
    ) public {
        ISavingsAccount SavingsAccount = ISavingsAccount(savingsAccount);

        SavingsAccount.deposit(token, strategy, to, amount);
    }
}
