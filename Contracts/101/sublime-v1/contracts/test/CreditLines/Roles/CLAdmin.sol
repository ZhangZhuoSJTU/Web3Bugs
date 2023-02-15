// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../../roles/Admin.sol';
import '../Helpers/CLConstants.sol';

contract CLAdmin is Admin {
    function deployCLContracts(
        address _mockUSDC,
        address _priceOracle,
        address _savingsAccount,
        address _strategyRegistry,
        address _mockProtocolFeeCollector
    ) public returns (address) {
        CreditLine _creditLine = new CreditLine(_mockUSDC, _priceOracle, _savingsAccount, _strategyRegistry);

        _creditLine.initialize(
            address(this),
            CLConstants.protocolFeeFraction,
            _mockProtocolFeeCollector,
            CLConstants.liquidatorRewardFraction
        );
        return (address(_creditLine));
    }

    function updateBorrowLimitLimits(
        uint256 _min,
        uint256 _max,
        address _creditLinAddress
    ) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateBorrowLimitLimits(_min, _max);
    }

    function updateIdealCollateralRatioLimits(
        uint256 _min,
        uint256 _max,
        address _creditLinAddress
    ) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateIdealCollateralRatioLimits(_min, _max);
    }

    function updateBorrowRateLimits(
        uint256 _min,
        uint256 _max,
        address _creditLinAddress
    ) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateBorrowRateLimits(_min, _max);
    }

    function updateProtocolFeeFraction(uint256 _protocolFeeFraction, address _creditLinAddress) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateProtocolFeeFraction(_protocolFeeFraction);
    }

    function updateProtocolFeeCollector(address _protocolFeeCollector, address _creditLinAddress) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function updateLiquidatorRewardFraction(uint256 _rewardFraction, address _creditLinAddress) public {
        CreditLine _creditLine = CreditLine(_creditLinAddress);
        _creditLine.updateLiquidatorRewardFraction(_rewardFraction);
    }

    //----------------------- Valid credit line function calls -----------------------//

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

    function setAllowance(
        address spender,
        address token,
        uint256 amount
    ) public {
        IERC20(token).approve(spender, amount);
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

    function setAllowanceForSavingsAccount(
        address savingsAccount,
        address token,
        address spender,
        uint256 amount
    ) public {
        SavingsAccount(savingsAccount).approve(token, spender, amount);
    }

    function savingsAccountDeposit(
        address savingsAccount,
        address token,
        address strategy,
        address to,
        uint256 amount
    ) public {
        SavingsAccount(savingsAccount).deposit(token, strategy, to, amount);
    }

    //----------------------- Invalid credit line function calls -----------------------//

    function acceptRequest(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.accept(id);
    }

    function cancelRequest(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.cancel(id);
    }

    function close(address creditLineAddress, uint256 id) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.close(id);
    }

    function updateBorrowLimit(
        address creditLineAddress,
        uint256 id,
        uint128 newBorrowLimit
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.updateBorrowLimit(id, newBorrowLimit);
    }

    function liquidate(
        address creditLineAddress,
        uint256 id,
        bool toSavingsAccount
    ) public {
        CreditLine creditLine = CreditLine(creditLineAddress);

        creditLine.liquidate(id, toSavingsAccount);
    }
}
