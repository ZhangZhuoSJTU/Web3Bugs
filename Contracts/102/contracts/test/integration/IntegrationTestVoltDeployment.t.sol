// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {Vm} from "./../unit/utils/Vm.sol";
import {ICore} from "../../core/ICore.sol";
import {DSTest} from "../unit/utils/DSTest.sol";
import {StdLib} from "../unit/utils/StdLib.sol";
import {MockERC20} from "../../mock/MockERC20.sol";
import {IVolt, Volt} from "../../volt/Volt.sol";
import {OraclePassThrough} from "../../oracle/OraclePassThrough.sol";
import {ScalingPriceOracle} from "../../oracle/ScalingPriceOracle.sol";
import {MockScalingPriceOracle} from "../../mock/MockScalingPriceOracle.sol";
import {ERC20CompoundPCVDeposit} from "../../pcv/compound/ERC20CompoundPCVDeposit.sol";
import {getCore, getAddresses, FeiTestAddresses} from "./../unit/utils/Fixtures.sol";
import {NonCustodialPSM, GlobalRateLimitedMinter} from "./../../peg/NonCustodialPSM.sol";

// Create Core
// Global Rate Limited Minter
// Oracle System
// - Scaling Price Oracle
// - Oracle Pass Through

contract IntegrationTestVoltDeployment is DSTest, StdLib {
    GlobalRateLimitedMinter private rateLimitedMinter;
    NonCustodialPSM private psm;
    ICore private core;
    ICore private feiCore = ICore(0x8d5ED43dCa8C2F7dFB20CF7b53CC7E593635d7b9);
    IVolt private volt;
    IVolt private fei = IVolt(0x956F47F50A910163D8BF957Cf5846D573E7f87CA);

    /// ------------ Minting and RateLimited System Params ------------

    uint256 public constant mintAmount = 10_000_000e18;
    uint256 public constant bufferCap = 10_000_000e18;
    uint256 public constant individualMaxBufferCap = 5_000_000e18;
    uint256 public constant rps = 10_000e18;

    /// ------------ Oracle System Params ------------

    /// @notice prices during test will increase 1% monthly
    int256 public constant monthlyChangeRateBasisPoints = 100;
    uint256 public constant maxDeviationThresholdBasisPoints = 1_000;

    /// @notice chainlink job id on mainnet
    bytes32 public immutable jobId =
        0x3666376662346162636564623438356162323765623762623339636166383237;
    /// @notice chainlink oracle address on mainnet
    address public immutable oracleAddress =
        0x049Bd8C3adC3fE7d3Fc2a44541d955A537c2A484;

    /// @notice live FEI PCV Deposit
    ERC20CompoundPCVDeposit public immutable rariFEIPCVDeposit =
        ERC20CompoundPCVDeposit(0x81DCB06eA4db474D1506Ca6275Ff7D870bA3A1Be);

    /// @notice fei DAO timelock address
    address public immutable feiDAOTimelock =
        0xd51dbA7a94e1adEa403553A8235C302cEbF41a3c;

    /// @notice Oracle Pass Through contract
    OraclePassThrough public oracle;

    Vm public constant vm = Vm(HEVM_ADDRESS);
    FeiTestAddresses public addresses = getAddresses();

    function setUp() public {
        core = getCore();
        volt = core.volt();
        MockScalingPriceOracle mockScalingPriceOracle = new MockScalingPriceOracle(
                oracleAddress,
                jobId,
                10e18,
                101,
                100
            );

        oracle = new OraclePassThrough(
            ScalingPriceOracle(address(mockScalingPriceOracle))
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

        NonCustodialPSM.PSMParams memory psmParams = NonCustodialPSM.PSMParams({
            mintFeeBasisPoints: 0,
            redeemFeeBasisPoints: 0,
            underlyingToken: fei,
            pcvDeposit: rariFEIPCVDeposit,
            rateLimitedMinter: rateLimitedMinter
        });

        /// create PSM
        psm = new NonCustodialPSM(
            oracleParams,
            multiRateLimitedParams,
            psmParams
        );

        vm.prank(feiDAOTimelock);
        feiCore.grantPCVController(address(psm));
        vm.prank(feiDAOTimelock);
        fei.mint(address(this), mintAmount);

        vm.startPrank(addresses.governorAddress);

        /// grant the PSM the PCV Controller role
        core.grantMinter(addresses.governorAddress);
        core.grantMinter(address(rateLimitedMinter));
        core.grantPCVController(address(psm));
        core.grantPCVController(addresses.governorAddress);
        rateLimitedMinter.addAddress(
            address(this),
            uint112(rps),
            uint112(bufferCap)
        );
        rateLimitedMinter.addAddress(
            address(psm),
            uint112(rps),
            uint112(bufferCap)
        );

        /// mint VOLT to the user
        volt.mint(address(this), mintAmount);

        vm.stopPrank();
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMintAmountOut() public {
        uint256 amountFeiIn = 100;
        assertEq(psm.getMintAmountOut(amountFeiIn), amountFeiIn);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMintAmountOutMintAmount() public {
        assertEq(psm.getMintAmountOut(mintAmount), mintAmount);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetMintAmountOutAfterTime() public {
        /// assert that for 101 stables you get 100 VOLT after volt price increases 1%
        uint256 amountFeiIn = 101_000;
        uint256 expectedAmountVoltOut = 99999; /// subtract 1 for precision loss from doInvert

        /// advance the full time period to get the full 1% price increase
        vm.warp(28 days + block.timestamp);

        assertEq(psm.getMintAmountOut(amountFeiIn), expectedAmountVoltOut);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetRedeemAmountOut() public {
        uint256 amountFeiIn = 100;
        assertEq(psm.getRedeemAmountOut(amountFeiIn), amountFeiIn);
    }

    /// @notice PSM is set up correctly and view functions are working
    function testGetRedeemAmountOutAfterTime() public {
        uint256 amountVoltIn = 100_000;
        uint256 expectedAmountStableOut = 101_000;

        /// advance the full time period to get the full 1% price increase
        vm.warp(28 days + block.timestamp);

        assertEq(psm.getRedeemAmountOut(amountVoltIn), expectedAmountStableOut);
    }

    /// this test uses FEI as the underlying asset and hooks into a FEI PCV Deposit
    function testSwap() public {
        rariFEIPCVDeposit.deposit(); // get env cleaned up and ready for testing
        uint256 startingUserVoltBalance = volt.balanceOf(address(this));
        uint256 startingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        fei.approve(address(psm), mintAmount);
        psm.mint(address(this), mintAmount, mintAmount);
        rariFEIPCVDeposit.deposit();

        uint256 endingUserVoltBalance = volt.balanceOf(address(this));
        uint256 endingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        assertEq(endingUserVoltBalance - startingUserVoltBalance, mintAmount);
        assertEq(
            endingPCVDepositFeiBalance - startingPCVDepositFeiBalance,
            mintAmount - 1 /// goes down by 1 because of cToken pricing rounding down
        );
    }

    /// this test uses FEI as the underlying asset and hooks into a FEI PCV Deposit
    function testMintAfterPriceIncrease() public {
        uint256 amountFeiIn = 101_000;
        uint256 amountVoltOut = 99_999;

        rariFEIPCVDeposit.deposit(); // get env cleaned up and ready for testing
        vm.warp(28 days + block.timestamp);

        uint256 startingUserVoltBalance = volt.balanceOf(address(this));
        uint256 startingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        fei.approve(address(psm), amountFeiIn);
        psm.mint(address(this), amountFeiIn, amountVoltOut);
        rariFEIPCVDeposit.deposit();

        uint256 endingUserVoltBalance = volt.balanceOf(address(this));
        uint256 endingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        assertEq(
            endingUserVoltBalance - startingUserVoltBalance,
            amountVoltOut
        );
        assertEq(
            endingPCVDepositFeiBalance - startingPCVDepositFeiBalance,
            amountFeiIn - 1
        );
    }

    /// this test uses FEI as the underlying asset and hooks into a FEI PCV Deposit
    function testRedeemAfterPriceIncrease() public {
        uint256 amountVoltIn = 100_000;
        uint256 amountFeiOut = 101_000;

        rariFEIPCVDeposit.deposit(); // get env cleaned up and ready for testing
        vm.warp(28 days + block.timestamp);

        uint256 startingUserVoltBalance = volt.balanceOf(address(this));
        uint256 startingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        volt.approve(address(psm), amountVoltIn);
        psm.redeem(address(this), amountVoltIn, amountFeiOut);
        rariFEIPCVDeposit.deposit();

        uint256 endingUserVoltBalance = volt.balanceOf(address(this));
        uint256 endingPCVDepositFeiBalance = rariFEIPCVDeposit.balance();

        assertEq(startingUserVoltBalance - endingUserVoltBalance, amountVoltIn);
        assertEq(
            startingPCVDepositFeiBalance - endingPCVDepositFeiBalance,
            amountFeiOut - 1
        );
    }

    function testGlobalRateLimitedMint() public {
        uint256 voltAvailableToMint = rateLimitedMinter.individualBuffer(
            address(this)
        );
        uint256 startingVolt = volt.balanceOf(address(this));

        rateLimitedMinter.mintMaxAllowableVolt(address(this));

        uint256 endingVolt = volt.balanceOf(address(this));

        assertEq(endingVolt, voltAvailableToMint + startingVolt);
    }
}
