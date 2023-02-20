// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {MockPCVDepositV2} from "../../../mock/MockPCVDepositV2.sol";
import {IPCVDeposit} from "../../../pcv/IPCVDeposit.sol";
import {MockERC20} from "../../../mock/MockERC20.sol";
import {OraclePassThrough} from "../../../oracle/OraclePassThrough.sol";
import {ScalingPriceOracle} from "../../../oracle/ScalingPriceOracle.sol";
import {MockScalingPriceOracle} from "../../../mock/MockScalingPriceOracle.sol";
import {ICore} from "../../../core/ICore.sol";
import {Core} from "../../../core/Core.sol";
import {IVolt, Volt} from "../../../volt/Volt.sol";
import {NonCustodialPSM, GlobalRateLimitedMinter} from "./../../../peg/NonCustodialPSM.sol";
import {Vm} from "./../utils/Vm.sol";
import {DSTest} from "./../utils/DSTest.sol";
import {getCore, getAddresses, FeiTestAddresses} from "./../utils/Fixtures.sol";

contract NonCustodialPSMTest is DSTest {
    GlobalRateLimitedMinter private rateLimitedMinter;
    NonCustodialPSM private psm;
    ICore private core;
    IVolt private volt;

    /// ------------ Minting and RateLimited System Params ------------

    uint256 public constant mintAmount = 10_000_000e18;
    uint256 public constant bufferCap = 10_000_000e18;
    uint256 public constant individualMaxBufferCap = 5_000_000e18;
    uint256 public constant rps = 10_000e18;

    /// ------------ Oracle System Params ------------

    /// @notice prices during test will increase 1% monthly
    int256 public constant monthlyChangeRateBasisPoints = 100;
    uint256 public constant maxDeviationThresholdBasisPoints = 1_000;

    MockERC20 public underlyingToken;
    MockPCVDepositV2 public pcvDeposit;
    OraclePassThrough public oracle;

    Vm public constant vm = Vm(HEVM_ADDRESS);
    FeiTestAddresses public addresses = getAddresses();

    function setUp() public {
        core = getCore();

        volt = core.volt();
        MockScalingPriceOracle mockScalingPriceOracle = new MockScalingPriceOracle(
                address(0),
                keccak256(abi.encodePacked("test")),
                10e18,
                101,
                100
            );

        oracle = new OraclePassThrough(
            ScalingPriceOracle(address(mockScalingPriceOracle))
        );
        underlyingToken = new MockERC20();
        pcvDeposit = new MockPCVDepositV2(
            address(core),
            address(underlyingToken),
            0,
            0
        );

        rateLimitedMinter = new GlobalRateLimitedMinter(
            address(core),
            rps,
            rps,
            rps,
            individualMaxBufferCap,
            bufferCap
        );

        NonCustodialPSM.OracleParams memory oracleParams = NonCustodialPSM
            .OracleParams({
                coreAddress: address(core),
                oracleAddress: address(oracle),
                backupOracle: address(0),
                decimalsNormalizer: 0
            });

        NonCustodialPSM.RateLimitedParams
            memory multiRateLimitedParams = NonCustodialPSM.RateLimitedParams({
                maxRateLimitPerSecond: rps,
                rateLimitPerSecond: rps,
                bufferCap: bufferCap
            });

        NonCustodialPSM.PSMParams memory PSMParams = NonCustodialPSM.PSMParams({
            mintFeeBasisPoints: 0,
            redeemFeeBasisPoints: 0,
            underlyingToken: underlyingToken,
            pcvDeposit: pcvDeposit,
            rateLimitedMinter: rateLimitedMinter
        });

        /// create PSM
        psm = new NonCustodialPSM(
            oracleParams,
            multiRateLimitedParams,
            PSMParams
        );

        vm.startPrank(addresses.governorAddress);

        /// grant the PSM the PCV Controller role
        core.grantMinter(addresses.governorAddress);
        core.grantMinter(address(rateLimitedMinter));
        core.grantPCVController(address(psm));
        core.grantPCVController(addresses.governorAddress);
        rateLimitedMinter.addAddress(
            address(psm),
            uint112(rps),
            uint112(bufferCap)
        );

        /// mint FEI to the user
        volt.mint(address(this), mintAmount);

        vm.stopPrank();

        /// mint the PSM and user some stable coins
        underlyingToken.mint(address(pcvDeposit), mintAmount);
        underlyingToken.mint(address(this), mintAmount);

        /// invest all excess tokens in the PCV deposit
        pcvDeposit.deposit();
    }

    /// @notice PSM is set up correctly, all state variables and balances are correct
    function testPSMSetup() public {
        uint256 startingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 startingUserFEIBalance = volt.balanceOf(address(this));

        assertEq(startingPSMUnderlyingBalance, 0);
        assertEq(startingUserFEIBalance, mintAmount);

        assertTrue(core.isPCVController(address(psm)));
        assertTrue(core.isMinter(address(rateLimitedMinter)));
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetRedeemAmountOut() public {
        uint256 amountFeiIn = 100;
        assertEq(psm.getRedeemAmountOut(amountFeiIn), amountFeiIn);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMaxMintAmountOut() public {
        assertEq(psm.getMaxMintAmountOut(), bufferCap);

        vm.startPrank(addresses.governorAddress);
        volt.mint(address(psm), mintAmount);
        vm.stopPrank();

        assertEq(psm.getMaxMintAmountOut(), bufferCap + mintAmount);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMintAmountOut() public {
        uint256 amountFeiIn = 100;
        assertEq(psm.getMintAmountOut(amountFeiIn), amountFeiIn);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetRedeemAmountOutAfterTime() public {
        uint256 amountVoltIn = 100_000;
        uint256 expectedAmountStableOut = 101_000;

        /// advance the full time period to get the full 1% price increase
        vm.warp(28 days + block.timestamp);

        assertEq(psm.getRedeemAmountOut(amountVoltIn), expectedAmountStableOut);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMintAmountOutAfterTime() public {
        /// assert that for 101 stables you get 100 VOLT after volt price increases 1%
        uint256 amountStableIn = 101_000;
        uint256 expectedAmountVoltOut = 99999; /// subtract 1 for precision loss from doInvert

        /// advance the full time period to get the full 1% price increase
        vm.warp(28 days + block.timestamp);

        assertEq(psm.getMintAmountOut(amountStableIn), expectedAmountVoltOut);
    }

    /// @notice pcv deposit receives underlying token on mint
    function testSwapUnderlyingForFeiAfterPriceIncrease() public {
        uint256 amountStableIn = 101_000;
        uint256 amountVoltOut = 99999; /// subtract 1 for precision loss from doInvert

        vm.warp(28 days + block.timestamp);

        underlyingToken.approve(address(psm), amountStableIn);
        psm.mint(address(this), amountStableIn, amountVoltOut);

        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(
            endingPCVDepositUnderlyingBalance,
            mintAmount + amountStableIn
        );
        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, mintAmount + amountVoltOut);
    }

    /// @notice pcv deposit receives underlying token on mint
    function testSwapUnderlyingForFei() public {
        underlyingToken.approve(address(psm), mintAmount);
        psm.mint(address(this), mintAmount, mintAmount);

        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(endingPCVDepositUnderlyingBalance, mintAmount * 2);
        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, mintAmount * 2);
    }

    /// @notice pcv deposit gets depleted on redeem
    function testSwapFeiForUnderlying() public {
        volt.approve(address(psm), mintAmount);
        psm.redeem(address(this), mintAmount, mintAmount);

        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingUserUnderlyingBalance = underlyingToken.balanceOf(
            address(this)
        );
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, 0);
        assertEq(endingUserUnderlyingBalance, mintAmount * 2);
        assertEq(endingPCVDepositUnderlyingBalance, 0);
    }

    /// @notice pcv deposit gets depleted on redeem
    function testSwapVoltForUnderlyingAfterPriceIncrease() public {
        uint256 amountVoltIn = 100_000;
        uint256 amountStableOut = 101_000;

        vm.warp(28 days + block.timestamp);

        volt.approve(address(psm), amountVoltIn);
        psm.redeem(address(this), amountVoltIn, amountStableOut);

        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingUserUnderlyingBalance = underlyingToken.balanceOf(
            address(this)
        );
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, mintAmount - amountVoltIn);
        assertEq(endingUserUnderlyingBalance, mintAmount + amountStableOut);
        assertEq(
            endingPCVDepositUnderlyingBalance,
            mintAmount - amountStableOut
        );
    }

    /// @notice pcv deposit gets depleted on redeem
    function testUnderlyingBufferDepletion() public {
        uint256 bufferStart = psm.buffer();

        volt.approve(address(psm), mintAmount);
        psm.redeem(address(this), mintAmount, mintAmount);

        uint256 bufferEnd = psm.buffer();
        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingUserUnderlyingBalance = underlyingToken.balanceOf(
            address(this)
        );
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, 0);
        assertEq(endingUserUnderlyingBalance, mintAmount * 2);
        assertEq(endingPCVDepositUnderlyingBalance, 0);
        assertEq(bufferStart, bufferCap);
        assertEq(bufferEnd, bufferCap - mintAmount);
    }

    /// @notice global rate limited minter buffer on the PSM gets depleted on mint
    function testFeiBufferDepletion() public {
        uint256 bufferStart = rateLimitedMinter.individualBuffer(address(psm));

        underlyingToken.approve(address(psm), mintAmount);
        psm.mint(address(this), mintAmount, mintAmount);

        uint256 bufferEnd = rateLimitedMinter.individualBuffer(address(psm));
        uint256 endingUserFEIBalance = volt.balanceOf(address(this));
        uint256 endingPSMUnderlyingBalance = underlyingToken.balanceOf(
            address(psm)
        );
        uint256 endingPCVDepositUnderlyingBalance = underlyingToken.balanceOf(
            address(pcvDeposit)
        );

        assertEq(endingPCVDepositUnderlyingBalance, mintAmount * 2);
        assertEq(endingPSMUnderlyingBalance, 0);
        assertEq(endingUserFEIBalance, mintAmount * 2);

        assertEq(bufferStart, bufferCap);
        assertEq(bufferEnd, bufferCap - mintAmount);
    }

    /// @notice replenishable rate limited minter buffer on the PSM gets increased on mint
    function testBufferReplenishment() public {
        /// drain buffer
        volt.approve(address(psm), mintAmount);
        psm.redeem(address(this), mintAmount, mintAmount);

        uint256 bufferStart = psm.bufferStored();

        underlyingToken.approve(address(psm), mintAmount);
        psm.mint(address(this), mintAmount, mintAmount);

        uint256 bufferEnd = psm.bufferStored();

        assertEq(bufferEnd - bufferStart, mintAmount);
    }

    /// @notice redeem fails without approval
    function testSwapFeiForUnderlyingFailsWithoutApproval() public {
        vm.expectRevert(bytes("ERC20: transfer amount exceeds allowance"));

        psm.redeem(address(this), mintAmount, mintAmount);
    }

    /// @notice mint fails without approval
    function testSwapUnderlyingForFeiFailsWithoutApproval() public {
        vm.expectRevert(bytes("ERC20: transfer amount exceeds allowance"));

        psm.mint(address(this), mintAmount, mintAmount);
    }

    /// @notice withdraw erc20 fails without correct permissions
    function testERC20WithdrawFailure() public {
        vm.expectRevert(bytes("CoreRef: Caller is not a PCV controller"));

        psm.withdrawERC20(address(underlyingToken), address(this), 100);
    }

    /// @notice withdraw erc20 succeeds with correct permissions
    function testERC20WithdrawSuccess() public {
        vm.startPrank(addresses.governorAddress);

        core.grantPCVController(address(this));
        underlyingToken.mint(address(psm), mintAmount);

        vm.stopPrank();

        uint256 startingBalance = underlyingToken.balanceOf(address(this));
        psm.withdrawERC20(address(underlyingToken), address(this), mintAmount);
        uint256 endingBalance = underlyingToken.balanceOf(address(this));

        assertEq(endingBalance - startingBalance, mintAmount);
    }

    /// @notice set global rate limited minter fails when caller is not governor
    function testSetGlobalRateLimitedMinterFailure() public {
        vm.expectRevert(bytes("UNAUTHORIZED"));

        psm.setGlobalRateLimitedMinter(GlobalRateLimitedMinter(address(this)));
    }

    /// @notice set global rate limited minter fails when caller is governor and new address is 0
    function testSetGlobalRateLimitedMinterFailureZeroAddress() public {
        vm.startPrank(addresses.governorAddress);

        vm.expectRevert(
            bytes("PegStabilityModule: Invalid new GlobalRateLimitedMinter")
        );
        psm.setGlobalRateLimitedMinter(GlobalRateLimitedMinter(address(0)));

        vm.stopPrank();
    }

    /// @notice set global rate limited minter succeeds when caller is governor
    function testSetGlobalRateLimitedMinterSuccess() public {
        vm.startPrank(addresses.governorAddress);

        psm.setGlobalRateLimitedMinter(GlobalRateLimitedMinter(address(this)));

        assertEq(address(psm.rateLimitedMinter()), address(this));

        vm.stopPrank();
    }

    /// @notice set global rate limited minter fails when caller is governor and new address is 0
    function testSetPCVDepositFailureZeroAddress() public {
        vm.startPrank(addresses.governorAddress);

        vm.expectRevert(bytes("PegStabilityModule: Invalid new PCVDeposit"));
        psm.setPCVDeposit(IPCVDeposit(address(0)));

        vm.stopPrank();
    }

    /// @notice set PCV deposit fails when caller is governor and new address is 0
    function testSetPCVDepositFailureNonGovernor() public {
        vm.expectRevert(bytes("UNAUTHORIZED"));
        psm.setPCVDeposit(IPCVDeposit(address(0)));
    }

    /// @notice set PCV deposit fails when caller is governor and new address is 0
    function testSetPCVDepositFailureUnderlyingTokenMismatch() public {
        vm.startPrank(addresses.governorAddress);

        MockPCVDepositV2 newPCVDeposit = new MockPCVDepositV2(
            address(core),
            address(volt),
            0,
            0
        );

        vm.expectRevert(bytes("PegStabilityModule: Underlying token mismatch"));

        psm.setPCVDeposit(IPCVDeposit(address(newPCVDeposit)));

        vm.stopPrank();
    }

    /// @notice set PCV Deposit succeeds when caller is governor and underlying tokens match
    function testSetPCVDepositSuccess() public {
        vm.startPrank(addresses.governorAddress);

        MockPCVDepositV2 newPCVDeposit = new MockPCVDepositV2(
            address(core),
            address(underlyingToken),
            0,
            0
        );

        psm.setPCVDeposit(IPCVDeposit(address(newPCVDeposit)));

        vm.stopPrank();

        assertEq(address(newPCVDeposit), address(psm.pcvDeposit()));
    }

    /// @notice set mint fee succeeds
    function testSetMintFeeSuccess() public {
        vm.startPrank(addresses.governorAddress);
        psm.setMintFee(100);
        vm.stopPrank();

        assertEq(psm.mintFeeBasisPoints(), 100);
    }

    /// @notice set mint fee fails unauthorized
    function testSetMintFeeFailsWithoutCorrectRoles() public {
        vm.expectRevert(bytes("UNAUTHORIZED"));

        psm.setMintFee(100);
    }

    /// @notice set redeem fee succeeds
    function testSetRedeemFeeSuccess() public {
        vm.startPrank(addresses.governorAddress);
        psm.setRedeemFee(100);
        vm.stopPrank();

        assertEq(psm.redeemFeeBasisPoints(), 100);
    }

    /// @notice set redeem fee fails unauthorized
    function testSetRedeemFeeFailsWithoutCorrectRoles() public {
        vm.expectRevert(bytes("UNAUTHORIZED"));

        psm.setRedeemFee(100);
    }

    /// @notice redeem fails when paused
    function testRedeemFailsWhenPaused() public {
        vm.startPrank(addresses.governorAddress);
        psm.pauseRedeem();
        vm.stopPrank();

        vm.expectRevert(bytes("PegStabilityModule: Redeem paused"));
        psm.redeem(address(this), 100, 100);
    }

    /// @notice mint fails when paused
    function testMintFailsWhenPaused() public {
        vm.startPrank(addresses.governorAddress);
        psm.pauseMint();
        vm.stopPrank();

        vm.expectRevert(bytes("PegStabilityModule: Minting paused"));
        psm.mint(address(this), 100, 100);
    }

    /// @notice redeem fails when price has not increased enough to get minAmountOut
    function testRedeemFailsWhenScalingPriceOracleIncreases() public {
        vm.warp(28 days + block.timestamp);

        vm.expectRevert(bytes("PegStabilityModule: Redeem not enough out"));
        psm.redeem(address(this), 100_000, 101_001);

        assertEq(oracle.getCurrentOraclePrice(), (1 ether * 101) / 100);
    }

    /// @notice mint fails when price has not increased enough to get minAmountVoltOut
    function testMintFailsWhenScalingPriceOracleIncreases() public {
        vm.warp(28 days + block.timestamp);

        vm.expectRevert(bytes("PegStabilityModule: Mint not enough out"));
        psm.mint(address(this), 101_000, 100_001);

        assertEq(oracle.getCurrentOraclePrice(), (1 ether * 101) / 100);
        /// subtract 1 for precision loss due to doInvert
        assertEq(psm.getMintAmountOut(101_000), 100_000 - 1);
    }
}
