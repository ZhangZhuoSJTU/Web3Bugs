pragma solidity 0.7.6;

import './Helpers/CLParent.sol';

contract CreditLine_UpdateFunctionTests is CLParent {
    CreditLine cl;

    function setUp() public {
        CLSetUp();

        cl = CreditLine(creditLineAddress);
    }

    //----------------------- Credit line update protocol fee collector, failing tests -----------------------//

    // Should fail when same address is used for fee collector update
    function test_updateProtocolFeeCollector_SameAddress() public {
        address currentFeeCollector = cl.protocolFeeCollector();
        try admin.updateProtocolFeeCollector(currentFeeCollector, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UPFC1');
        }
    }

    // Should fail when zero address is used for fee collector update
    function test_updateProtocolFeeCollector_zeroAddress() public {
        try admin.updateProtocolFeeCollector(address(0), address(cl)) {
            revert('REVERT: Zero Address');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:IUPFC1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateProtocolFeeCollector_InvalidActor() public {
        address randomAddr = address(uint256(keccak256(abi.encodePacked(block.timestamp))));
        try cl.updateProtocolFeeCollector(randomAddr) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update protocol fee collector, passing tests -----------------------//

    // Should fail when fee collector address is updated
    function test_creditLineUpdateProtocolFeeCollector(address protocolFeeCollector) public {
        try admin.updateProtocolFeeCollector(protocolFeeCollector, address(cl)) {
            address updatedFeeCollector = cl.protocolFeeCollector();
            assertEq(updatedFeeCollector, protocolFeeCollector);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:UPFC1')) {
                log_string('Same address used for update');
            } else if (compareStrings(reason, 'CL:IUPFC1')) {
                log_string('address(0) used for update');
            } else {
                revert(reason);
            }
        }
    }

    //----------------------- Credit line update protocol fee fraction, failing tests -----------------------//

    // Should fail when same value is used for updates
    function test_updateProtocolFeeFraction_SameValue() public {
        uint256 currentProtocolFee = cl.protocolFeeFraction();
        try admin.updateProtocolFeeFraction(currentProtocolFee, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UPFF1');
        }
    }

    // Should fail when vaue >1 is used for updates
    function test_updateProtocolFeeFraction_InvalidFraction() public {
        try admin.updateProtocolFeeFraction(1e20, address(cl)) {
            revert('REVERT: Invalid value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:IUPFF1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateProtocolFeeFraction_InvalidActor() public {
        try cl.updateProtocolFeeFraction(1e25) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update protocol fee fraction, passing tests -----------------------//

    // Should pass when protocol fee is updated
    function test_creditLineUpdateProtocolFeeFraction(uint256 protocolFeeFraction) public {
        try admin.updateProtocolFeeFraction(protocolFeeFraction, address(cl)) {
            uint256 updatedProtocolFee = cl.protocolFeeFraction();
            assertEq(updatedProtocolFee, protocolFeeFraction);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:UPFF1')) {
                log_string('Same value used for update');
            } else if (compareStrings(reason, 'CL:IUPFF1')) {
                log_string('invalid (>1) value used for update');
            } else {
                revert(reason);
            }
        }
    }

    // Should pass when zero vaue is used for updates
    function test_updateProtocolFeeFraction_zeroValue() public {
        admin.updateProtocolFeeFraction(0, address(cl));
        uint256 updatedProtocolFee = cl.protocolFeeFraction();
        assertEq(updatedProtocolFee, 0);
    }

    //----------------------- Credit line update liquidator reward fraction, failing tests -----------------------//

    // Should fail when same value is used for updates
    function test_updateLiquidatorRewardFraction_SameValue() public {
        uint256 currentLiquidatorReward = cl.liquidatorRewardFraction();
        try admin.updateLiquidatorRewardFraction(currentLiquidatorReward, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ULRF1');
        }
    }

    // Should fail when value higher than limit is used for updates
    function test_updateLiquidatorRewardFraction_ExceedsValue() public {
        try admin.updateLiquidatorRewardFraction(1e18 + 1, address(cl)) {
            revert('REVERT: Invalid value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:IULRF1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateLiquidatorRewardFraction_InvalidActor() public {
        try cl.updateLiquidatorRewardFraction(1e25) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update liquidator reward fraction, passing tests -----------------------//

    // Should pass when liquidator reward fraction is updated
    function test_creditLineUpdateLiquidatorRewardFraction(uint256 liquidatorReward) public {
        try admin.updateLiquidatorRewardFraction(liquidatorReward, address(cl)) {
            uint256 updatedLiquidatorReward = cl.liquidatorRewardFraction();
            assertEq(updatedLiquidatorReward, liquidatorReward);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:ULRF1')) {
                log_string('Same value used for update');
            } else if (compareStrings(reason, 'CL:IULRF1')) {
                log_string('invalid (>1) value used for update');
            } else {
                revert(reason);
            }
        }
    }

    // Should pass when zero vaue is used for updates
    function test_updateLiquidatorRewardFraction_zeroValue() public {
        admin.updateLiquidatorRewardFraction(0, address(cl));
        uint256 updatedLiquidatorReward = cl.liquidatorRewardFraction();
        assertEq(updatedLiquidatorReward, 0);
    }

    //----------------------- Credit line update borrow limit limits, failing tests -----------------------//

    // Should fail when the same limits are used for updates
    function test_updateBorrowLimitLimits_SameLimits() public {
        (uint256 currMin, uint256 currMax) = cl.borrowLimitLimits();
        try admin.updateBorrowLimitLimits(currMin, currMax, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UBLL2');
        }
    }

    // Should fail when min limit > max limit
    function test_updateBorrowLimitLimits_MaxMin() public {
        try admin.updateBorrowLimitLimits(1e20, 1, address(cl)) {
            revert('REVERT: Invalid Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UBLL1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateBorrowLimitLimits_InvalidActor() public {
        try cl.updateBorrowLimitLimits(1, 1e20) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update borrow limit limits, passing tests -----------------------//

    // Should pass when borrow limit limits are updated
    function test_creditLineupdateBorrowLimitLimits(uint128 _min, uint128 _max) public {
        try admin.updateBorrowLimitLimits(_min, _max, address(cl)) {
            (uint256 min, uint256 max) = cl.borrowLimitLimits();
            assertEq(min, uint256(_min));
            assertEq(max, uint256(_max));
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:UBLL2')) {
                log_string('Same values used for update');
            } else if (compareStrings(reason, 'CL:UBLL1')) {
                log_string('Invalid values used for update');
            } else {
                revert(reason);
            }
        }
    }

    // Should pass when zero value is used for limits
    function test_updateBorrowLimitLimits_zero() public {
        admin.updateBorrowLimitLimits(0, 0, address(cl));
        (uint256 min, uint256 max) = cl.borrowLimitLimits();
        assertEq(min, 0);
        assertEq(max, 0);
    }

    // Should pass when same limit value is used (both minimum)
    function test_updateBorrowLimitLimits_SameMin() public {
        admin.updateBorrowLimitLimits(1, 1, address(cl));
        (uint256 min, uint256 max) = cl.borrowLimitLimits();
        assertEq(min, 1);
        assertEq(max, 1);
    }

    // Should pass when same limit value is used (both maximum)
    function test_updateBorrowLimitLimits_SameMax() public {
        admin.updateBorrowLimitLimits(1e20, 1e20, address(cl));
        (uint256 min, uint256 max) = cl.borrowLimitLimits();
        assertEq(min, 1e20);
        assertEq(max, 1e20);
    }

    //----------------------- Credit line update ideal collateral ratio limits, failing tests -----------------------//

    // Should fail when same limits are used for updates
    function test_updateIdealCollateralRatioLimits_SameLimits() public {
        (uint256 currMin, uint256 currMax) = cl.idealCollateralRatioLimits();
        try admin.updateIdealCollateralRatioLimits(currMin, currMax, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UICRL2');
        }
    }

    // Should fail when min limit > max limit
    function test_updateIdealCollateralRatioLimits_MaxMin() public {
        try admin.updateIdealCollateralRatioLimits(1e30, 1, address(cl)) {
            revert('REVERT: Invalid Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UICRL1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateIdealCollateralRatioLimits_InvalidActor() public {
        try cl.updateIdealCollateralRatioLimits(1, 1e30) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update ideal collateral ratio limits, passing tests -----------------------//

    // Should pass when ideal collateral ratio is updated
    function test_creditLineupdateIdealCollateralRatioLimits(uint128 _min, uint128 _max) public {
        try admin.updateIdealCollateralRatioLimits(_min, _max, address(cl)) {
            (uint256 min, uint256 max) = cl.idealCollateralRatioLimits();
            assertEq(min, uint256(_min));
            assertEq(max, uint256(_max));
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:UICRL2')) {
                log_string('Same values used for update');
            } else if (compareStrings(reason, 'CL:UICRL1')) {
                log_string('Invalid values used for update');
            } else {
                revert(reason);
            }
        }
    }

    // Should pass when zero value is used for limits
    function test_updateIdealCollateralRatioLimits_zero() public {
        admin.updateIdealCollateralRatioLimits(0, 0, address(cl));
        (uint256 min, uint256 max) = cl.idealCollateralRatioLimits();
        assertEq(min, 0);
        assertEq(max, 0);
    }

    // Should fail when same limit value is used (both minimum)
    function test_updateIdealCollateralRatioLimits_SameMin() public {
        admin.updateIdealCollateralRatioLimits(1, 1, address(cl));
        (uint256 min, uint256 max) = cl.idealCollateralRatioLimits();
        assertEq(min, 1);
        assertEq(max, 1);
    }

    // Should fail when same limit value is used (both maximum)
    function test_updateIdealCollateralRatioLimits_SameMax() public {
        admin.updateIdealCollateralRatioLimits(1e30, 1e30, address(cl));
        (uint256 min, uint256 max) = cl.idealCollateralRatioLimits();
        assertEq(min, 1e30);
        assertEq(max, 1e30);
    }

    //----------------------- Credit line update borrow rate limits, failing tests -----------------------//

    // Should fail when same values are used for updates
    function test_updateBorrowRateLimits_SameLimits() public {
        (uint256 currMin, uint256 currMax) = cl.borrowRateLimits();
        try admin.updateBorrowRateLimits(currMin, currMax, address(cl)) {
            revert('REVERT: Same Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UBRL2');
        }
    }

    // Should fail when min limit > max limit
    function test_updateBorrowRateLimits_MaxMin() public {
        try admin.updateBorrowRateLimits(1e20, 1, address(cl)) {
            revert('REVERT: Invalid Value');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:UBRL1');
        }
    }

    // Should fail when invalid actor (not admin) calls updates
    function test_updateBorrowRateLimits_InvalidActor() public {
        try cl.updateBorrowRateLimits(1, 1e20) {
            revert('REVERT: Invalid actor');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Credit line update borrow rate limits, passing tests -----------------------//

    // Should pass when borrow rate limit is updated
    function test_creditLineupdateBorrowRateLimits(uint128 _min, uint128 _max) public {
        try admin.updateBorrowRateLimits(_min, _max, address(cl)) {
            (uint256 min, uint256 max) = cl.borrowRateLimits();
            assertEq(min, uint256(_min));
            assertEq(max, uint256(_max));
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'CL:UBRL2')) {
                log_string('Same values used for update');
            } else if (compareStrings(reason, 'CL:UBRL1')) {
                log_string('invalid values used for update');
            } else {
                revert(reason);
            }
        }
    }

    // Should pass when zero value is used for update
    function test_updateBorrowRateLimits_zero() public {
        admin.updateBorrowRateLimits(0, 0, address(cl));
        (uint256 min, uint256 max) = cl.borrowRateLimits();
        assertEq(min, 0);
        assertEq(max, 0);
    }

    // Should fail when same limit value is used for update (both minimum)
    function test_updateBorrowRateLimits_SameMin() public {
        admin.updateBorrowRateLimits(1, 1, address(cl));
        (uint256 min, uint256 max) = cl.borrowRateLimits();
        assertEq(min, 1);
        assertEq(max, 1);
    }

    // Should fail when same limit value is used for update (both maximum)
    function test_updateBorrowRateLimits_SameMax() public {
        admin.updateBorrowRateLimits(1e30, 1e30, address(cl));
        (uint256 min, uint256 max) = cl.borrowRateLimits();
        assertEq(min, 1e30);
        assertEq(max, 1e30);
    }
}
