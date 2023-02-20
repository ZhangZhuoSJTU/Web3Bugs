// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import {BaseFixture} from "./BaseFixture.sol";
import {SupplySchedule} from "../SupplySchedule.sol";
import {GlobalAccessControl} from "../GlobalAccessControl.sol";
import {Funding} from "../Funding.sol";
import {FixedPointMathLib} from "solmate/utils/FixedPointMathLib.sol";

import "../interfaces/erc20/IERC20.sol";

contract FundingTest is BaseFixture {
    using FixedPointMathLib for uint;

    function setUp() public override {
        BaseFixture.setUp();
    }
    
    function testDiscountRateBasics() public {
        /** 
        @fatima: confirm the discount rate is functional
        - access control for setting discount rate (i.e. the proper accounts can call the function and it works. improper accounts revert when attempting to call)
        - access control for setting discount rate limits
        - pausing freezes these functions appropriately
    */

        // calling from correct account
        vm.prank(address(governance));
        fundingCvx.setDiscountLimits(10, 50);
        vm.prank(address(policyOps));
        fundingCvx.setDiscount(20);
        (uint256 discount,uint256 minDiscount,uint256 maxDiscount,,,) = fundingCvx.funding();
        // check if discount is set
        assertEq(discount,20);

        // setting discount above maximum limit

        vm.prank(address(policyOps));
        vm.expectRevert(bytes("discount > maxDiscount"));
        fundingCvx.setDiscount(60);

        // setting discount below minimum limit
        vm.prank(address(policyOps));
        vm.expectRevert(bytes("discount < minDiscount"));
        fundingCvx.setDiscount(5);

        // calling setDiscount from a different account
        vm.prank(address(1));
        vm.expectRevert(bytes("GAC: invalid-caller-role-or-address"));
        fundingCvx.setDiscount(20);

        // - access control for setting discount rate limits

        // calling with correct role
        vm.prank(address(governance));
        fundingCvx.setDiscountLimits(0, 50);
        (,minDiscount,maxDiscount,,,) = fundingCvx.funding();

        // checking if limits are set
        assertEq(minDiscount,0);
        assertEq(maxDiscount, 50);

        // check discount can not be greater than or equal to MAX_BPS
        vm.prank(address(governance));
        vm.expectRevert(bytes("maxDiscount >= MAX_BPS"));
        fundingCvx.setDiscountLimits(0, 10000);

        // calling with wrong address
        vm.prank(address(1));
        vm.expectRevert(bytes("GAC: invalid-caller-role"));
        fundingCvx.setDiscountLimits(0,20);

        // - pausing freezes these functions appropriately
        vm.prank(guardian);
        gac.pause();
        vm.prank(address(governance));
        vm.expectRevert(bytes("global-paused"));
        fundingCvx.setDiscountLimits(0, 50);
        vm.prank(address(policyOps));
        vm.expectRevert(bytes("global-paused"));
        fundingCvx.setDiscount(10);

    }

    function testDiscountRateBuys() public{
        _testDiscountRateBuys(fundingCvx, cvx, 100e18, 5000, 100e18 );

    }

    function testBuyDifferentDecimals() public {
        // wBTC is an 8 decimal example
        // TODO: Fix comparator calls in inner function as per that functions comment
        _testDiscountRateBuys(fundingWbtc, wbtc, 2e8, 2000, 2e8 );

    }

    function testSetAssetCap() public{
        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        fundingCvx.setAssetCap(10e18);

        // setting asset cap from correct account
        vm.prank(policyOps);
        fundingCvx.setAssetCap(1000e18);
        (,,,,,uint256 assetCap) = fundingCvx.funding();
        assertEq(assetCap, 1000e18); // check if assetCap is set

        // checking assetCap can not be less than accumulated funds.
         _testDiscountRateBuys(fundingCvx, cvx, 100e18, 3000, 100e18 );
        vm.prank(policyOps);
        vm.expectRevert("cannot decrease cap below global sum of assets in");
        fundingCvx.setAssetCap(10e18);
    }

    function testFailClaimAssetToTreasury() public{

        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        fundingCvx.claimAssetToTreasury();

        uint256 amount = cvx.balanceOf(address(fundingCvx));
        uint256 balanceBefore = cvx.balanceOf(fundingCvx.saleRecipient());

        vm.prank(treasuryOps);
        fundingCvx.claimAssetToTreasury();

        uint256 balanceAfter = cvx.balanceOf(fundingCvx.saleRecipient());

        // check the difference of saleRecipient's balance is equal to the amount
        assertEq(amount, balanceAfter-balanceBefore);

    }

    function testSweep() public {
        
        vm.stopPrank();
        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        fundingCvx.sweep(address(cvx));

        vm.prank(treasuryOps);
        vm.expectRevert("nothing to sweep");
        fundingCvx.sweep(address(cvx));

    }
    function testAccessControl() public{
        // tests to check access controls of various set functions
        
        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        fundingCvx.setDiscountManager(address(2));

        // setting discountManager from correct account
        vm.prank(governance);
        fundingCvx.setDiscountManager(address(2));
        (,,,address discountManager,,) = fundingCvx.funding();
        assertEq(discountManager, address(2)); // check if discountManager is set

        vm.prank(address(1));
        vm.expectRevert("onlyCitadelPriceInAssetOracle");
        fundingCvx.updateCitadelPriceInAsset(1000);

        // setting citadelPriceInAsset from correct account
        vm.prank(eoaOracle);
        fundingCvx.updateCitadelPriceInAsset(1000);
        assertEq(fundingCvx.citadelPriceInAsset(), 1000); // check if citadelPriceInAsset is set
        
        vm.prank(eoaOracle);
        vm.expectRevert("citadel price must not be zero");
        fundingCvx.updateCitadelPriceInAsset(0);

        vm.prank(address(1));
        vm.expectRevert("GAC: invalid-caller-role");
        fundingCvx.setSaleRecipient(address(2));

        // setting setSaleRecipient from correct account
        vm.prank(governance);
        fundingCvx.setSaleRecipient(address(2));
        assertEq(fundingCvx.saleRecipient(), address(2)); // check if SaleRecipient is set
        
        vm.prank(governance);
        vm.expectRevert("Funding: sale recipient should not be zero");
        fundingCvx.setSaleRecipient(address(0));
    }
    
    function testDepositModifiers() public{
        // pausing should freeze deposit
        vm.prank(guardian);
        gac.pause();
        vm.expectRevert(bytes("global-paused"));
        fundingCvx.deposit(10e18 , 0);
        vm.prank(address(techOps));
        gac.unpause();

        // flagging citadelPriceFlag should freeze deposit
        vm.prank(governance);
        fundingCvx.setCitadelAssetPriceBounds(0, 5000);
        vm.prank(eoaOracle);
        fundingCvx.updateCitadelPriceInAsset(6000);
        vm.expectRevert(bytes("Funding: citadel price from oracle flagged and pending review"));
        fundingCvx.deposit(10e18 , 0);

    }

    function _testDiscountRateBuys(Funding fundingContract, IERC20 token, uint256 _assetAmountIn, uint32 discount, uint256 citadelPrice) public {
        
        /**
            @fatima: this is a good candidate to generalize using fuzzing: test buys with various discount rates, using fuzzing, and confirm the results.
            sanity check the numerical results (tokens in vs tokens out, based on price and discount rate)
        */ 

        vm.assume(discount<10000 && _assetAmountIn>0 && citadelPrice>0);  // discount < MAX_BPS = 10000 

        vm.prank(address(governance));
        fundingContract.setDiscountLimits(0, 9999);
        
        vm.prank(address(policyOps));
        fundingContract.setDiscount(discount); // set discount

        vm.prank(eoaOracle);
        fundingContract.updateCitadelPriceInAsset(citadelPrice); // set citadel price

        uint256 citadelAmountOutExpected = fundingContract.getAmountOut(_assetAmountIn);

        vm.prank(governance);
        citadel.mint(address(fundingContract), citadelAmountOutExpected ); // fundingContract should have citadel to transfer to user

        address user = address(1) ;
        vm.startPrank(user);
        erc20utils.forceMintTo(user, address(token) , _assetAmountIn );
        token.approve(address(fundingContract), _assetAmountIn);
        uint256 citadelAmountOut = fundingContract.deposit(_assetAmountIn , 0);
        vm.stopPrank();

        // check citadelAmoutOut is same as expected
        assertEq(citadelAmountOut , citadelAmountOutExpected);

    }
    
    function _testBuy(Funding fundingContract, uint assetIn, uint citadelPrice) internal {
        // just make citadel appear rather than going through minting flow here
        erc20utils.forceMintTo(address(fundingContract), address(citadel), 100000e18);
        
        vm.prank(eoaOracle);

        // CVX funding contract gives us an 18 decimal example
        fundingContract.updateCitadelPriceInAsset(citadelPrice);

        uint expectedAssetOut = assetIn.divWadUp(citadelPrice);
        
        emit log_named_uint("Citadel Price", citadelPrice);

        vm.startPrank(whale);

        require(cvx.balanceOf(whale) >= assetIn, "buyer has insufficent assets for specified buy amount");
        require(citadel.balanceOf(address(fundingContract)) >= expectedAssetOut, "funding has insufficent citadel for specified buy amount");

        comparator.snapPrev();
        cvx.approve(address(fundingContract), cvx.balanceOf(whale));

        fundingContract.deposit(assetIn, 0);
        comparator.snapCurr();

        uint expectedAssetLost = assetIn;
        uint expectedxCitadelGained = citadelPrice;

        // user trades in asset for citadel in xCitadel form.
        assertEq(comparator.diff("citadel.balanceOf(whale)"), 0);
        assertEq(comparator.diff("xCitadel.balanceOf(whale)"), expectedAssetOut);
        assertEq(comparator.negDiff("cvx.balanceOf(whale)"), assetIn);
        
        // funding contract loses citadel and sends asset to saleRecipient. should never hold an xCitadel balance (deposited for each user) (gas costs?)

        // TODO: Improve comparator to easily add new entity for all balance calls.
        assertEq(comparator.negDiff("citadel.balanceOf(fundingCvx)"), expectedAssetOut);
        assertEq(comparator.diff("cvx.balanceOf(treasuryVault)"), assetIn);
        
        assertEq(xCitadel.balanceOf(address(fundingContract)), 0);

        vm.stopPrank();
    }
 }
