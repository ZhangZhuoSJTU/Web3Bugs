// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.12;

import {DSTest} from "./helpers/test.sol";
import {Vm} from "./helpers/Vm.sol";

import {NFTLoanFacilitator} from "contracts/NFTLoanFacilitator.sol";
import {NFTLoanFacilitatorFactory} from "./helpers/NFTLoanFacilitatorFactory.sol";
import {BorrowTicket} from "contracts/BorrowTicket.sol";
import {LendTicket} from "contracts/LendTicket.sol";
import {CryptoPunks} from "./mocks/CryptoPunks.sol";
import {DAI} from "./mocks/DAI.sol";

contract NFTLoanFacilitatorGasBenchMarkTest is DSTest {
    Vm vm = Vm(HEVM_ADDRESS);
    NFTLoanFacilitator facilitator;
    CryptoPunks punks = new CryptoPunks();
    DAI dai = new DAI();
    uint256 punkId;
    uint16 interestRate = 15;
    uint128 loanAmount = 1e20;
    uint32 loanDuration = 1000;
    uint256 startTimestamp = 5;

    function setUp() public {
        NFTLoanFacilitatorFactory factory = new NFTLoanFacilitatorFactory();
        (, , facilitator) = factory.newFacilitator(address(this));

        // approve for lending
        dai.mint(loanAmount * 3, address(this));
        dai.approve(address(facilitator), loanAmount * 3);

        // create a loan so we can close it or lend against it
        punkId = punks.mint();
        punks.approve(address(facilitator), punkId);
        facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            address(this)
        );

        // mint another punk so we can create a second loan
        punks.mint();
        punks.approve(address(facilitator), punkId + 1);

        // prevent errors from timestamp 0
        vm.warp(startTimestamp);

        // create another loan and lend against it so we can buyout or repay
        punks.mint();
        punks.approve(address(facilitator), punkId + 2);
        facilitator.createLoan(
            punkId + 2,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            address(this)
        );
        facilitator.lend(
            2,
            interestRate,
            loanAmount,
            loanDuration,
            address(this)
        );
    }

    function testCreateLoan() public {
        facilitator.createLoan(
            punkId + 1,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            address(this)
        );
    }

    function testCloseLoan() public {
        facilitator.closeLoan(1, address(this));
    }

    function testLend() public {
        facilitator.lend(
            1,
            interestRate,
            loanAmount,
            loanDuration,
            address(this)
        );
    }

    function testLendBuyout() public {
        facilitator.lend(
            2,
            interestRate,
            loanAmount + ((loanAmount * 10) / 100),
            loanDuration,
            address(this)
        );
    }

    function testRepayAndClose() public {
        facilitator.repayAndCloseLoan(2);
    }

    function testSeizeCollateral() public {
        vm.warp(startTimestamp + loanDuration + 1);
        facilitator.seizeCollateral(2, address(this));
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract NFTLoanFacilitatorTest is DSTest {
    event CreateLoan(
        uint256 indexed id,
        address indexed minter,
        uint256 collateralTokenId,
        address collateralContract,
        uint256 maxInterestRate,
        address loanAssetContract,
        uint256 minLoanAmount,
        uint256 minDurationSeconds
    );

    event Lend(
        uint256 indexed id,
        address indexed lender,
        uint256 interestRate,
        uint256 loanAmount,
        uint256 durationSeconds
    );

    event BuyoutLender(
        uint256 indexed id,
        address indexed lender,
        address indexed replacedLoanOwner,
        uint256 interestEarned,
        uint256 replacedAmount
    );

    Vm vm = Vm(HEVM_ADDRESS);

    NFTLoanFacilitator facilitator;
    BorrowTicket borrowTicket;
    LendTicket lendTicket;

    address borrower = address(1);
    address lender = address(2);

    CryptoPunks punks = new CryptoPunks();
    DAI dai = new DAI();

    uint16 interestRate = 15;
    uint128 loanAmount = 1e20;
    uint32 loanDuration = 1000;
    uint256 startTimestamp = 5;
    uint256 punkId;

    function setUp() public {
        NFTLoanFacilitatorFactory factory = new NFTLoanFacilitatorFactory();
        (borrowTicket, lendTicket, facilitator) = factory.newFacilitator(
            address(this)
        );
        vm.warp(startTimestamp);

        vm.startPrank(borrower);
        punkId = punks.mint();
        punks.approve(address(facilitator), punkId);
        vm.stopPrank();
    }

    function testCreateLoanEmitsCorrectly() public {
        vm.expectEmit(true, true, true, true);
        emit CreateLoan(
            1,
            borrower,
            punkId,
            address(punks),
            interestRate,
            address(dai),
            loanAmount,
            loanDuration
        );
        vm.prank(borrower);
        facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );
    }

    function testCreateLoanTransfersCollateralToSelf() public {
        vm.prank(borrower);
        facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );

        assertEq(punks.ownerOf(punkId), address(facilitator));
    }

    function testCreateLoanMintsBorrowTicketCorrectly() public {
        address mintBorrowTicketTo = address(3);
        vm.prank(borrower);
        uint256 loanId = facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            mintBorrowTicketTo
        );

        assertEq(borrowTicket.ownerOf(loanId), mintBorrowTicketTo);
    }

    function testCreateLoanSetsValuesCorrectly(
        uint16 maxPerAnumInterest,
        uint128 minLoanAmount,
        uint32 minDurationSeconds,
        address mintTo
    ) public {
        vm.assume(minLoanAmount > 0);
        vm.assume(minDurationSeconds > 0);
        vm.assume(mintTo != address(0));

        vm.prank(borrower);
        uint256 loanId = facilitator.createLoan(
            punkId,
            address(punks),
            maxPerAnumInterest,
            minLoanAmount,
            address(dai),
            minDurationSeconds,
            mintTo
        );
        (
            bool closed,
            uint16 perAnumInterestRate,
            uint32 durationSeconds,
            uint40 lastAccumulatedTimestamp,
            address collateralContractAddress,
            address loanAssetContractAddress,
            uint128 accumulatedInterest,
            uint128 loanAmountFromLoan,
            uint256 collateralTokenId
        ) = facilitator.loanInfo(loanId);

        assertTrue(!closed);
        assertEq(durationSeconds, minDurationSeconds);
        assertEq(perAnumInterestRate, maxPerAnumInterest);
        assertEq(loanAmountFromLoan, minLoanAmount);
        assertEq(lastAccumulatedTimestamp, 0);
        assertEq(accumulatedInterest, 0);
        assertEq(collateralContractAddress, address(punks));
        assertEq(collateralTokenId, punkId);
        assertEq(loanAssetContractAddress, address(dai));
    }

    function testCreateLoanZeroDurationNotAllowed() public {
        vm.startPrank(borrower);
        vm.expectRevert("NFTLoanFacilitator: 0 duration");
        facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            0,
            borrower
        );
    }

    function testCreateLoanZeroAmountNotAllowed() public {
        vm.startPrank(borrower);
        vm.expectRevert("NFTLoanFacilitator: 0 loan amount");
        facilitator.createLoan(
            punkId,
            address(punks),
            interestRate,
            0,
            address(dai),
            loanDuration,
            borrower
        );
    }

    function testCreateLoanAddressZeroCollateralFails() public {
        vm.startPrank(borrower);
        vm.expectRevert(bytes(""));
        facilitator.createLoan(
            punkId,
            address(0),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );
    }

    function testBorrowTicketUnusableAsCollateral() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        vm.startPrank(borrower);

        borrowTicket.approve(address(facilitator), loanId);
        vm.expectRevert("NFTLoanFacilitator: cannot use tickets as collateral");
        facilitator.createLoan(
            loanId,
            address(borrowTicket),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );
    }

    function testLendTicketUnusableAsCollateral() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        vm.startPrank(lender);

        lendTicket.approve(address(facilitator), loanId);
        vm.expectRevert("NFTLoanFacilitator: cannot use tickets as collateral");
        facilitator.createLoan(
            loanId,
            address(lendTicket),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );
    }

    function testSuccessfulCloseLoan() public {
        (uint256 tokenId, uint256 loanId) = setUpLoanForTest(borrower);
        vm.startPrank(borrower);

        facilitator.closeLoan(loanId, borrower);
        assertEq(punks.ownerOf(tokenId), borrower); // make sure borrower gets their NFT back
        (bool closed, , , , , , , , ) = facilitator.loanInfo(loanId);
        assertTrue(closed); // make sure loan was closed
    }

    function testClosingAlreadyClosedLoan() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        vm.startPrank(borrower);

        facilitator.closeLoan(loanId, borrower);

        // closing an already closed loan should revert
        vm.expectRevert("NFTLoanFacilitator: loan closed");
        facilitator.closeLoan(loanId, borrower);
    }

    function testClosingLoanWithLender() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        vm.startPrank(borrower);

        dai.mint(loanAmount, borrower);
        dai.approve(address(facilitator), loanAmount); // approve for lending
        vm.warp(startTimestamp); // make sure there's a non-zero timestamp
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            borrower
        ); // have borrower lend, this is not realistic, but will do for this test

        // loan has lender, should now revert
        vm.expectRevert(
            "NFTLoanFacilitator: has lender, use repayAndCloseLoan"
        );
        facilitator.closeLoan(loanId, borrower);
    }

    function testClosingLoanFromNonBorrower() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);

        vm.startPrank(address(2));
        vm.expectRevert("NFTLoanFacilitator: borrow ticket holder only");
        facilitator.closeLoan(loanId, borrower);
        vm.stopPrank();
    }

    function testInterestExceedingUint128BuyoutReverts() public {
        loanAmount = type(uint128).max;
        // 100% APR
        interestRate = 1000;
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        facilitator.interestOwed(loanId);
        vm.warp(startTimestamp + 366 days);
        
        vm.expectRevert("NFTLoanFacilitator: accumulated interest exceeds uint128");
        facilitator.lend(loanId, 0, loanAmount, loanDuration, address(4));
    }

    function testInterestExceedingUint128InterestOwed() public {
        loanAmount = type(uint128).max;
        // 100% APR
        interestRate = 1000;
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        vm.warp(startTimestamp + 366 days);
        facilitator.interestOwed(loanId); 
    }

    function testRepayInterestOwedExceedingUint128() public {
        loanAmount = type(uint128).max;
        // 100% APR
        interestRate = 1000;
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        vm.warp(startTimestamp + 366 days);
        uint256 t = facilitator.totalOwed(loanId);
        vm.startPrank(address(3));
        dai.mint(t, address(3));
        dai.approve(address(facilitator), t);
        facilitator.repayAndCloseLoan(loanId);
        vm.stopPrank();
    }

    function testLendMintsLendTicketCorrectly() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        setUpLender(lender);
        vm.startPrank(lender);
         facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            lender
        );

        assertEq(lendTicket.ownerOf(loanId), lender);
    }

    function testLendTransfersERC20Correctly() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        setUpLender(lender);

        uint256 lenderBalance = dai.balanceOf(lender);

        vm.startPrank(lender);
         facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            lender
        );

        assertEq(dai.balanceOf(lender), lenderBalance - loanAmount);
        uint256 facilitatorTake = loanAmount * facilitator.originationFeeRate() / facilitator.SCALAR();
        assertEq(dai.balanceOf(address(facilitator)), facilitatorTake);
        assertEq(dai.balanceOf(borrower), loanAmount - facilitatorTake);
    }

    function testLendUpdatesValuesCorrectly(
        uint16 rate,
        uint128 amount,
        uint32 duration,
        address sendTo
    ) public {
        vm.assume(rate <= interestRate);
        vm.assume(amount >= loanAmount);
        vm.assume(duration >= loanDuration);
        vm.assume(sendTo != address(0));
        vm.assume(amount < type(uint256).max / 10); // else origination fee multiplication overflows

        (uint256 tokenId, uint256 loanId) = setUpLoanForTest(borrower);

        dai.mint(amount, address(this));
        dai.approve(address(facilitator), amount);

        facilitator.lend(
            loanId,
            rate,
            amount,
            duration,
            sendTo
        );
        (
            bool closed,
            uint16 interest,
            uint32 durationSeconds,
            uint40 lastAccumulatedTimestamp,
            address collateralContractAddress,
            address loanAssetContractAddress,
            uint128 accumulatedInterest,
            uint128 loanAmountFromLoan,
            uint256 collateralTokenId
        ) = facilitator.loanInfo(loanId);

        assertTrue(!closed);
        assertEq(rate, interest);
        assertEq(duration, durationSeconds);
        assertEq(amount, loanAmountFromLoan);
        assertEq(lastAccumulatedTimestamp, startTimestamp);
        assertEq(accumulatedInterest, 0);
        // does not change immutable values
        assertEq(collateralContractAddress, address(punks));
        assertEq(loanAssetContractAddress, address(dai));
        assertEq(collateralTokenId, tokenId);
    }

    function testLendEmitsCorrectly() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);

        dai.mint(loanAmount, address(this));
        dai.approve(address(facilitator), loanAmount);

        vm.expectEmit(true, true, false, true);
        emit Lend(
            loanId,
            address(this),
            interestRate,
            loanAmount,
            loanDuration
        );

        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            address(1)
        );
    }

    function testSuccessfulLend() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);

        setUpLender(lender);
        vm.startPrank(lender);
        uint256 lenderBalance = dai.balanceOf(lender);

        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            lender
        );
        (
            ,
            ,
            ,
            uint40 lastAccumulatedTimestamp,
            ,
            ,
            uint256 accumulatedInterest,
            ,

        ) = facilitator.loanInfo(loanId);
        assertEq(lastAccumulatedTimestamp, startTimestamp);
        assertEq(accumulatedInterest, 0);

        // make sure lenders dai is transfered and lender gets lend ticket
        assertEq(dai.balanceOf(lender), lenderBalance - loanAmount);
        assertEq(lendTicket.ownerOf(loanId), lender);

        // make sure Facilitator subtracted origination fee
        uint256 facilitatorTake = (loanAmount *
            facilitator.originationFeeRate()) / facilitator.SCALAR();
        assertEq(dai.balanceOf(address(facilitator)), facilitatorTake);

        // make sure borrower got their loan in DAI
        assertEq(dai.balanceOf(borrower), loanAmount - facilitatorTake);
    }

    function testLoanValuesNotChangedAfterLend() public {
        (uint256 tokenId, uint256 loanId) = setUpLoanForTest(borrower);

        setUpLender(lender);
        vm.startPrank(lender);

        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            lender
        );
        (
            bool closed,
            uint16 interest,
            uint32 durationSeconds,
            uint40 lastAccumulatedTimestamp,
            address collateralContractAddress,
            address loanAssetContractAddress,
            uint128 accumulatedInterest,
            uint128 loanAmountFromLoan,
            uint256 collateralTokenId
        ) = facilitator.loanInfo(loanId);

        assertTrue(!closed);
        assertEq(interestRate, interest);
        assertEq(lastAccumulatedTimestamp, startTimestamp);
        assertEq(durationSeconds, loanDuration);
        assertEq(accumulatedInterest, 0);
        assertEq(loanAmountFromLoan, loanAmount);
        assertEq(collateralContractAddress, address(punks));
        assertEq(loanAssetContractAddress, address(dai));
        assertEq(collateralTokenId, tokenId);
    }

    function testLendFailsIfHigherInterestRate(uint16 rate, uint32 duration, uint128 amount) public {
        vm.assume(rate > interestRate);
        vm.assume(duration >= loanDuration);
        vm.assume(amount >= loanAmount);
        (, uint256 loanId) = setUpLoanForTest(borrower);

        setUpLender(lender);
        vm.startPrank(lender);
        vm.expectRevert("NFTLoanFacilitator: rate too high");
        facilitator.lend(
            loanId,
            rate,
            amount,
            duration,
            lender
        );
    }

    function testLendFailsIfLowerAmount(uint16 rate, uint32 duration, uint128 amount) public {
        vm.assume(rate <= interestRate);
        vm.assume(duration >= loanDuration);
        vm.assume(amount < loanAmount);
        (, uint256 loanId) = setUpLoanForTest(borrower);

        setUpLender(lender);
        vm.startPrank(lender);
        vm.expectRevert("NFTLoanFacilitator: amount too low");
        facilitator.lend(
            loanId,
            rate,
            amount,
            duration,
            lender
        );
    }

    function testLendFailsIfLowerDuration(uint16 rate, uint32 duration, uint128 amount) public {
        vm.assume(rate <= interestRate);
        vm.assume(duration < loanDuration);
        vm.assume(amount >= loanAmount);
        (, uint256 loanId) = setUpLoanForTest(borrower);

        setUpLender(lender);
        vm.startPrank(lender);
        vm.expectRevert("NFTLoanFacilitator: duration too low");
        facilitator.lend(
            loanId,
            rate,
            amount,
            duration,
            lender
        );
    }

    function testInterestAccruesCorrectly() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        setUpLender(lender);
        vm.startPrank(lender);
        facilitator.lend(
            loanId,
            10, // 1% annual rate
            loanAmount,
            loanDuration,
            lender
        );

        uint256 interestAccrued = facilitator.interestOwed(loanId);
        assertEq(interestAccrued, 0);

        uint256 elapsedTime = 1; // simulate fast forwarding 100 seconds
        vm.warp(startTimestamp + elapsedTime);

        // 1 second with 1% annual = 0.000000031709792% per second
        // 0.00000000031709792 * 10^20 = 31709791983
        assertEq(facilitator.interestOwed(loanId), 31709791983);

        // 1 year with 1% annual on 10^20 = 10^18
        // tiny loss of precision, 10^18 - 999999999997963200 = 2036800
        // => 0.000000000002037 in the case of currencies with 18 decimals
        vm.warp(startTimestamp + 365 days);
        assertEq(facilitator.interestOwed(loanId), 999999999997963200);
    }

    function testBuyoutSucceedsIfRateImproved(uint16 rate) public {
        vm.assume(rate <= decreaseByMinPercent(interestRate));
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);

        facilitator.lend(
            loanId,
            rate,
            loanAmount,
            loanDuration,
            newLender
        );
    }

    function testBuyoutSucceedsIfAmountImproved(uint128 amount) public {
        vm.assume(amount < type(uint256).max / 10); // else origination fee multiplication overflows
        vm.assume(amount >= increaseByMinPercent(loanAmount));
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        uint256 amountIncrease = amount - loanAmount;
        dai.mint(amountIncrease, newLender);

        vm.startPrank(newLender);
        facilitator.lend(
            loanId,
            interestRate,
            amount,
            loanDuration,
            newLender
        );
    }

    function testBuyoutSucceedsIfDurationImproved(uint32 duration) public {
        vm.assume(duration >= increaseByMinPercent(loanDuration));
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);

        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            duration,
            newLender
        );
    }

    function testBuyoutUpdatesValuesCorrectly() public {
        (uint256 tokenId, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        uint32 newDuration = uint32(increaseByMinPercent(loanDuration));

        vm.prank(newLender);
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            newDuration,
            address(1)
        );
        (
            bool closed,
            uint16 interest,
            uint32 durationSeconds,
            uint40 lastAccumulatedTimestamp,
            address collateralContractAddress,
            address loanAssetContractAddress,
            uint128 accumulatedInterest,
            uint128 loanAmountFromLoan,
            uint256 collateralTokenId
        ) = facilitator.loanInfo(loanId);

        assertTrue(!closed);
        assertEq(interestRate, interest);
        assertEq(newDuration, durationSeconds);
        assertEq(loanAmount, loanAmountFromLoan);
        assertEq(lastAccumulatedTimestamp, startTimestamp);
        assertEq(accumulatedInterest, 0);
        // does not change immutable values
        assertEq(collateralContractAddress, address(punks));
        assertEq(loanAssetContractAddress, address(dai));
        assertEq(collateralTokenId, tokenId);
    }

    function testBuyoutUpdatesAccumulatedInterestCorrectly() public {
        
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        uint256 elapsedTime = 100;
        vm.warp(startTimestamp + elapsedTime);
        uint256 interest = facilitator.interestOwed(loanId);
        uint32 newDuration = uint32(increaseByMinPercent(loanDuration));

        dai.mint(loanAmount + interest, address(this));
        dai.approve(address(facilitator), loanAmount + interest);

        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            newDuration,
            address(1)
        );
        (
            ,
            ,
            ,
            uint40 lastAccumulatedTimestamp,
            ,
            ,
            uint256 accumulatedInterest,
            ,
            
        ) = facilitator.loanInfo(loanId);

        assertEq(lastAccumulatedTimestamp, startTimestamp + elapsedTime);
        assertEq(accumulatedInterest, interest);
    }

    function testBuyoutTransfersLendTicket() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        uint32 newDuration = uint32(increaseByMinPercent(loanDuration));

        vm.prank(newLender);
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            newDuration,
            newLender
        );

        assertEq(lendTicket.ownerOf(loanId), newLender);
    }

    function testBuyoutPaysPreviousLenderCorrectly(uint128 amount) public {
        vm.assume(amount >= loanAmount);
        vm.assume(amount < type(uint256).max / 10); // else origination fee multiplication overflows
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        vm.warp(startTimestamp + 100);
        uint256 interest = facilitator.interestOwed(loanId);

        dai.mint(amount + interest, address(this));
        dai.approve(address(facilitator), amount + interest);

        uint256 beforeBalance = dai.balanceOf(lender);
        
        facilitator.lend(
            loanId,
            interestRate,
            amount,
            uint32(increaseByMinPercent(loanDuration)),
            address(1)
        );

        assertEq(beforeBalance + loanAmount + interest, dai.balanceOf(lender));
    }

    function testBuyoutPaysBorrowerCorrectly(uint128 amount) public {
        vm.assume(amount >= loanAmount);
        vm.assume(amount < type(uint256).max / 10); // else origination fee multiplication overflows
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        dai.mint(amount, address(this));
        dai.approve(address(facilitator), amount);

        uint256 beforeBalance = dai.balanceOf(borrower);
        
        facilitator.lend(
            loanId,
            interestRate,
            amount,
            uint32(increaseByMinPercent(loanDuration)),
            address(1)
        );

        uint256 amountIncrease = amount - loanAmount;
        uint256 originationFee = amountIncrease * facilitator.originationFeeRate() / facilitator.SCALAR();
        assertEq(beforeBalance + (amountIncrease - originationFee), dai.balanceOf(borrower));
    }

    function testBuyoutPaysFacilitatorCorrectly(uint128 amount) public {
        vm.assume(amount >= loanAmount);
        vm.assume(amount < type(uint256).max / 10); // else origination fee multiplication overflows
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        dai.mint(amount, newLender);
        vm.startPrank(newLender);
        dai.approve(address(facilitator), amount);

        uint256 beforeBalance = dai.balanceOf(address(facilitator));
        
        facilitator.lend(
            loanId,
            interestRate,
            amount,
            uint32(increaseByMinPercent(loanDuration)),
            address(1)
        );

        uint256 amountIncrease = amount - loanAmount;
        uint256 originationFee = amountIncrease * facilitator.originationFeeRate() / facilitator.SCALAR();
        assertEq(beforeBalance + originationFee, dai.balanceOf(address(facilitator)));
    }

    function testBuyoutEmitsCorrectly() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);
        
        address newLender = address(3);
        setUpLender(newLender);
        uint32 newDuration = uint32(increaseByMinPercent(loanDuration));

        vm.expectEmit(true, true, true, true);
        emit BuyoutLender(
            loanId,
            newLender,
            lender,
            0,
            loanAmount
        );

        vm.expectEmit(true, true, false, true);
        emit Lend(
            loanId,
            newLender,
            interestRate,
            loanAmount,
            newDuration
        );

        vm.prank(newLender);
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            newDuration,
            address(1)
        );
    }

    function testBuyoutFailsIfTermsNotImproved() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        vm.expectRevert(
            "NFTLoanFacilitator: proposed terms must be better than existing terms"
        );
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            newLender
        );
    }

    function testBuyoutFailsIfLoanAmountNotSufficientlyImproved() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        uint256 newAmount = increaseByMinPercent(loanAmount) - 1;
        vm.expectRevert(
            "NFTLoanFacilitator: proposed terms must be better than existing terms"
        );
        facilitator.lend(
            loanId,
            interestRate,
            uint128(newAmount),
            loanDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testBuyoutFailsIfLoanDurationNotSufficientlyImproved() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        uint32 newDuration = uint32(increaseByMinPercent(loanDuration) - 1);
        vm.expectRevert(
            "NFTLoanFacilitator: proposed terms must be better than existing terms"
        );
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            newDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testBuyoutFailsIfInterestRateNotSufficientlyImproved() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        uint16 newRate = uint16(decreaseByMinPercent(interestRate) + 1);
        vm.expectRevert(
            "NFTLoanFacilitator: proposed terms must be better than existing terms"
        );
        facilitator.lend(
            loanId,
            newRate,
            loanAmount,
            loanDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testBuyoutFailsIfLoanAmountRegressed(uint16 newRate, uint32 newDuration, uint128 newAmount) public {
        vm.assume(newRate <= interestRate);
        vm.assume(newDuration >= loanDuration);
        vm.assume(newAmount < loanAmount);
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        facilitator.lend(
            loanId,
            newRate,
            uint128(newAmount),
            newDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testBuyoutFailsIfInterestRateRegressed(uint16 newRate, uint32 newDuration, uint128 newAmount) public {
        vm.assume(newRate > interestRate);
        vm.assume(newDuration >= loanDuration);
        vm.assume(newAmount >= loanAmount);
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        vm.expectRevert("NFTLoanFacilitator: rate too high");
        facilitator.lend(
            loanId,
            newRate,
            uint128(newAmount),
            newDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testBuyoutFailsIfDurationRegressed(uint16 newRate, uint32 newDuration, uint128 newAmount) public {
        vm.assume(newRate <= interestRate);
        vm.assume(newDuration < loanDuration);
        vm.assume(newAmount >= loanAmount);
        (, uint256 loanId) = setUpLoanWithLenderForTest(borrower, lender);

        address newLender = address(3);
        setUpLender(newLender);
        vm.startPrank(newLender);
        vm.expectRevert("NFTLoanFacilitator: duration too low");
        facilitator.lend(
            loanId,
            newRate,
            uint128(newAmount),
            newDuration,
            newLender
        );
        vm.stopPrank();
    }

    function testRepayAndCloseSuccessful() public {
        (uint256 tokenId, uint256 loanId) = setUpLoanWithLenderForTest(
            borrower,
            lender
        );
        vm.warp(startTimestamp + 10); // warp so we have some interest accrued on the loan
        vm.startPrank(borrower);

        uint256 interestAccrued = facilitator.interestOwed(loanId);
        dai.mint(interestAccrued + calculateTake(loanAmount), borrower); // give borrower enough money to pay back the loan
        dai.approve(address(facilitator), loanAmount + interestAccrued);
        uint256 balanceOfBorrower = dai.balanceOf(borrower);

        facilitator.repayAndCloseLoan(loanId);

        // ensure ERC20 balances are correct
        assertEq(
            dai.balanceOf(borrower),
            balanceOfBorrower - (loanAmount + interestAccrued)
        );
        assertEq(dai.balanceOf(lender), loanAmount + interestAccrued);

        assertEq(punks.ownerOf(tokenId), borrower); // ensure borrower gets their NFT back
        (bool closed, , , , , , , , ) = facilitator.loanInfo(loanId); // ensure loan is closed on-chain
        assertTrue(closed);
    }

    function testRepayAndCloseFailsIfLoanClosed() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        vm.startPrank(borrower);
        facilitator.closeLoan(loanId, borrower);
        vm.expectRevert("NFTLoanFacilitator: loan closed");
        facilitator.repayAndCloseLoan(loanId);
    }

    function testSeizeCollateralSuccessful() public {
        (uint256 tokenId, uint256 loanId) = setUpLoanWithLenderForTest(
            borrower,
            lender
        );
        vm.warp(startTimestamp + loanDuration + 1); // fast forward to timestamp where loan would be overdue
        vm.prank(lender);

        facilitator.seizeCollateral(loanId, lender);
        assertEq(punks.ownerOf(tokenId), lender); // ensure lender seized collateral

        (bool closed, , , , , , , , ) = facilitator.loanInfo(loanId); // ensure loan is closed on-chain
        assertTrue(closed);
    }

    function testSeizeCollateralFailsIfLoanNotOverdue() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(
            borrower,
            lender
        );
        vm.warp(startTimestamp + loanDuration); // fast forward to timestamp where loan would not be overdue
        vm.prank(lender);

        vm.expectRevert("NFTLoanFacilitator: payment is not late");
        facilitator.seizeCollateral(loanId, lender);
    }

    function testSeizeCollateralFailsIfNonLoanOwnerCalls() public {
        (, uint256 loanId) = setUpLoanWithLenderForTest(
            borrower,
            lender
        );
        address randomAddress = address(4);
        vm.prank(randomAddress);

        vm.expectRevert("NFTLoanFacilitator: lend ticket holder only");
        facilitator.seizeCollateral(loanId, randomAddress);
    }

    function testSeizeCollateralFailsIfLoanIsClosed() public {
        (, uint256 loanId) = setUpLoanForTest(borrower);
        vm.prank(borrower);
        facilitator.closeLoan(loanId, borrower);

        vm.startPrank(lender);
        vm.expectRevert("NFTLoanFacilitator: loan closed");
        facilitator.seizeCollateral(loanId, lender);
        vm.stopPrank();
    }

    function testUpdateOriginationFeeRevertsIfNotCalledByManager() public {
        vm.startPrank(address(1));
        vm.expectRevert("Ownable: caller is not the owner");
        facilitator.updateOriginationFeeRate(1);
    }

    function testUpdateOriginationFeeRevertsIfGreaterThanFivePercent() public {
        uint256 interestRateDecimals = facilitator.INTEREST_RATE_DECIMALS();
        vm.startPrank(address(this));
        vm.expectRevert("NFTLoanFacilitator: max fee 5%");
        facilitator.updateOriginationFeeRate(
            uint32(6 * (10**(interestRateDecimals - 2)))
        );
    }

    function testUpdateOriginationFeeWorks() public {
        uint256 interestRateDecimals = facilitator.INTEREST_RATE_DECIMALS();
        vm.startPrank(address(this));
        facilitator.updateOriginationFeeRate(
            uint32(2 * (10**(interestRateDecimals - 2)))
        );
        assertEq(
            facilitator.originationFeeRate(),
            uint32(2 * (10**(interestRateDecimals - 2)))
        );
    }

    function testUpdateRequiredImprovementRateRevertsIfNotCalledByManager()
        public
    {
        vm.startPrank(address(1));
        vm.expectRevert("Ownable: caller is not the owner");
        facilitator.updateRequiredImprovementRate(1);
    }

    function testUpdateRequiredImprovementRateRevertsIf0()
        public
    {
        vm.startPrank(address(this));
        vm.expectRevert("NFTLoanFacilitator: 0 improvement rate");
        facilitator.updateRequiredImprovementRate(0);
    }

    function testUpdateRequiredImprovementRateWorks() public {
        vm.startPrank(address(this));
        facilitator.updateRequiredImprovementRate(20 * facilitator.SCALAR());
        assertEq(
            facilitator.requiredImprovementRate(),
            20 * facilitator.SCALAR()
        );
    }

    function setUpLender(address lenderAddress) public {
        // create a lender address and give them some approved dai
        vm.startPrank(lenderAddress);
        dai.mint(loanAmount, lenderAddress);
        dai.approve(address(facilitator), 2**256 - 1); // approve for lending
        vm.stopPrank();
    }

    function setUpLoanWithLenderForTest(
        address borrowerAddress,
        address lenderAddress
    ) public returns (uint256 tokenId, uint256 loanId) {
        (tokenId, loanId) = setUpLoanForTest(borrowerAddress);
        setUpLender(lenderAddress);
        vm.startPrank(lenderAddress);
        facilitator.lend(
            loanId,
            interestRate,
            loanAmount,
            loanDuration,
            lender
        );
        vm.stopPrank();
    }

    // returns tokenId of NFT used as collateral for the loan and loanId to be used in other test methods
    function setUpLoanForTest(address borrowerAddress)
        public
        returns (uint256 tokenId, uint256 loanId)
    {
        vm.startPrank(borrowerAddress);
        tokenId = punks.mint();
        punks.approve(address(facilitator), tokenId);
        loanId = facilitator.createLoan(
            tokenId,
            address(punks),
            interestRate,
            loanAmount,
            address(dai),
            loanDuration,
            borrower
        );
        vm.stopPrank();
    }

    function increaseByMinPercent(uint256 old) public view returns (uint256) {
        return
            old +
            old * 
            facilitator.requiredImprovementRate() /
            facilitator.SCALAR();
    }

    function decreaseByMinPercent(uint256 old) public view returns (uint256) {
        return old - old * facilitator.requiredImprovementRate() / facilitator.SCALAR();
    }

    function calculateTake(uint256 amount) public view returns (uint256) {
        return
            (amount * facilitator.originationFeeRate()) /
            facilitator.SCALAR();
    }
}

contract NFTLendTicketTest is DSTest {
    Vm vm = Vm(HEVM_ADDRESS);
    NFTLoanFacilitator facilitator;
    BorrowTicket borrowTicket;
    LendTicket lendTicket;

    function setUp() public {
        NFTLoanFacilitatorFactory factory = new NFTLoanFacilitatorFactory();
        (borrowTicket, lendTicket, facilitator) = factory.newFacilitator(
            address(this)
        );
    }

    function testLoanFacilitatorTransferSuccessful() public {
        address holder = address(1);
        address receiver = address(2);
        uint256 loanId = 0;

        vm.startPrank(address(facilitator));

        lendTicket.mint(holder, loanId);
        assertEq(lendTicket.ownerOf(loanId), holder);

        lendTicket.loanFacilitatorTransfer(holder, receiver, 0);
        assertEq(lendTicket.ownerOf(loanId), receiver);
    }

    function testLoanFacilitatorTransferRevertsIfNotFacilitator() public {
        vm.startPrank(address(1));
        vm.expectRevert("NFTLoanTicket: only loan facilitator");
        lendTicket.loanFacilitatorTransfer(address(1), address(2), 0);
    }
}
