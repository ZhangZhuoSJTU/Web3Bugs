// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {Authority} from "solmate/auth/Auth.sol";
import {ERC4626} from "solmate/mixins/ERC4626.sol";
import {DSTestPlus} from "solmate/test/utils/DSTestPlus.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626} from "solmate/test/utils/mocks/MockERC4626.sol";
import {FixedPointMathLib} from "solmate/utils/FixedPointMathLib.sol";

import {MockCToken} from "./mocks/MockCToken.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";
import {MockFuseAdmin} from "./mocks/MockFuseAdmin.sol";
import {MockComptroller} from "./mocks/MockComptroller.sol";

import {TurboClerk} from "../modules/TurboClerk.sol";
import {TurboBooster} from "../modules/TurboBooster.sol";

import {TurboSafe} from "../TurboSafe.sol";
import {TurboMaster} from "../TurboMaster.sol";

contract TurboSafeTest is DSTestPlus {
    using FixedPointMathLib for uint256;

    TurboMaster master;

    TurboClerk clerk;

    TurboBooster booster;

    MockFuseAdmin fuseAdmin;

    MockComptroller comptroller;

    MockERC20 fei;

    MockERC20 asset;

    MockCToken assetCToken;

    MockCToken feiCToken;

    MockERC4626 vault;

    TurboSafe safe;

    function setUp() public {
        fei = new MockERC20("Fei USD", "FEI", 18);

        asset = new MockERC20("Mock Token", "MOCK", 18);

        fuseAdmin = new MockFuseAdmin();

        booster = new TurboBooster(address(this), Authority(address(0)));

        clerk = new TurboClerk(address(this), Authority(address(0)));

        comptroller = new MockComptroller(address(fuseAdmin), new MockPriceFeed());

        master = new TurboMaster(comptroller, fei, address(this), Authority(address(0)));

        assetCToken = new MockCToken(asset);

        comptroller.mapUnderlyingToCToken(asset, assetCToken);

        feiCToken = new MockCToken(fei);

        comptroller.mapUnderlyingToCToken(fei, feiCToken);

        vault = new MockERC4626(fei, "Mock Fei Vault", "mvFEI");

        master.setBooster(booster);

        master.setClerk(clerk);

        (safe, ) = master.createSafe(asset);

        asset.mint(address(this), type(uint256).max);
        asset.approve(address(safe), type(uint256).max);
    }

    /*///////////////////////////////////////////////////////////////
                      DEPOSIT/WITHDRAWAL TESTS
    //////////////////////////////////////////////////////////////*/

    function testDeposit(uint128 amount, address to) public {
        if (amount == 0) amount = 1;

        safe.deposit(amount, to);

        assertEq(safe.balanceOf(to), amount);
        assertEq(safe.assetsOf(to), amount);
        assertEq(assetCToken.balanceOfUnderlying(address(safe)), amount);
        assertEq(safe.totalAssets(), amount);
    }

    function testDepositRedeem(uint128 amount, address to) public {
        if (amount == 0) amount = 1;

        uint256 toBalance = asset.balanceOf(to);

        safe.deposit(amount, address(this));
        safe.redeem(amount, to, address(this));

        assertEq(safe.totalAssets(), 0);
        assertEq(safe.balanceOf(to), 0);
        assertEq(asset.balanceOf(to), to == address(this) ? toBalance : toBalance + amount);
        assertEq(assetCToken.balanceOfUnderlying(address(safe)), 0);
    }

    function testDepositWithdraw(uint128 amount, address to) public {
        if (amount == 0) amount = 1;

        uint256 toBalance = asset.balanceOf(to);

        safe.deposit(amount, address(this));
        safe.withdraw(amount, to, address(this));

        assertEq(safe.totalAssets(), 0);
        assertEq(safe.balanceOf(to), 0);
        assertEq(asset.balanceOf(to), to == address(this) ? toBalance : toBalance + amount);
        assertEq(assetCToken.balanceOfUnderlying(address(safe)), 0);
    }

    /*///////////////////////////////////////////////////////////////
                             BOOST TESTS
    //////////////////////////////////////////////////////////////*/

    function testFailBoostNotEnoughCollateral(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        feiAmount = uint128(bound(feiAmount, feiMintAmount + 1, type(uint128).max));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(vault, feiAmount);
        booster.setBoostCapForCollateral(asset, feiAmount);

        safe.boost(vault, feiAmount);
    }

    function testFailBoostVaultCapTooLow(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        feiAmount = uint128(bound(feiAmount, 0, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(vault, bound(feiAmount, 0, feiAmount - 1));
        booster.setBoostCapForCollateral(asset, feiAmount);

        safe.boost(vault, feiAmount);
    }

    function testFailBoostCollateralCapTooLow(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        feiAmount = uint128(bound(feiAmount, 0, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(vault, feiAmount);
        booster.setBoostCapForCollateral(asset, bound(feiAmount, 0, feiAmount - 1));

        safe.boost(vault, feiAmount);
    }

    function testFailBoostFrozen(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        feiAmount = uint128(bound(feiAmount, 0, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(vault, feiAmount);
        booster.setBoostCapForCollateral(asset, feiAmount);

        booster.setFreezeStatus(true);

        safe.boost(vault, feiAmount);
    }

    function testFailInvalidVault(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to,
        ERC4626 invalidVault
    ) public {
        feiAmount = uint128(bound(feiAmount, 0, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(invalidVault, feiAmount);
        booster.setBoostCapForCollateral(invalidVault, feiAmount);

        safe.boost(invalidVault, feiAmount);
    }

    function testFailWrongAssetVault(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        feiAmount = uint128(bound(feiAmount, 0, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        MockERC4626 wrongAssetVault = new MockERC4626(asset, "Wrong Asset Vault", "WAV");

        booster.setBoostCapForVault(wrongAssetVault, feiAmount);
        booster.setBoostCapForCollateral(wrongAssetVault, feiAmount);

        safe.boost(wrongAssetVault, feiAmount);
    }

    function testBoost(
        uint128 underlyingAmount,
        uint128 feiMintAmount,
        uint128 feiAmount,
        address to
    ) public {
        if (underlyingAmount == 0) underlyingAmount = 1;
        if (feiMintAmount == 0) feiMintAmount = 1;

        feiAmount = uint128(bound(feiAmount, 1, feiMintAmount));

        safe.deposit(underlyingAmount, to);

        fei.mint(address(feiCToken), feiMintAmount);

        booster.setBoostCapForVault(vault, feiAmount);
        booster.setBoostCapForCollateral(asset, feiAmount);

        safe.boost(vault, feiAmount);

        assertEq(safe.totalFeiBoosted(), feiAmount);
        assertEq(safe.getTotalFeiBoostedForVault(vault), feiAmount);
        assertEq(vault.assetsOf(address(safe)), feiAmount);
        assertEq(vault.totalAssets(), feiAmount);
        assertEq(feiCToken.borrowBalanceCurrent(address(safe)), feiAmount);

        assertEq(master.totalBoosted(), feiAmount);
        assertEq(master.getTotalBoostedForVault(vault), feiAmount);
        assertEq(master.getTotalBoostedAgainstCollateral(asset), feiAmount);
    }

    /*///////////////////////////////////////////////////////////////
                             LESS TESTS
    //////////////////////////////////////////////////////////////*/

    function testBoostAndLess(
        uint128 boostAmount,
        uint128 lessAmount,
        address to
    ) public {
        if (boostAmount == 0) boostAmount = 1;
        if (lessAmount == 0) lessAmount = 1;

        lessAmount = uint128(bound(lessAmount, 0, boostAmount));

        safe.deposit(boostAmount, to);

        fei.mint(address(feiCToken), boostAmount);

        booster.setBoostCapForVault(vault, boostAmount);
        booster.setBoostCapForCollateral(asset, boostAmount);

        safe.boost(vault, boostAmount);

        safe.less(vault, lessAmount);

        uint256 delta = boostAmount - lessAmount;

        assertEq(safe.totalFeiBoosted(), delta);
        assertEq(safe.getTotalFeiBoostedForVault(vault), delta);
        assertEq(vault.assetsOf(address(safe)), delta);
        assertEq(vault.totalAssets(), delta);
        assertEq(feiCToken.borrowBalanceCurrent(address(safe)), delta);

        assertEq(master.totalBoosted(), delta);
        assertEq(master.getTotalBoostedForVault(vault), delta);
        assertEq(master.getTotalBoostedAgainstCollateral(asset), delta);
    }

    /*///////////////////////////////////////////////////////////////
                             SLURP TESTS
    //////////////////////////////////////////////////////////////*/

    function testFailSlurpUntrustedVault(ERC4626 untrustedVault) public {
        if (untrustedVault == vault) revert();

        safe.slurp(untrustedVault);
    }

    function testSlurp(
        uint64 boostAmount,
        uint64 donationAmount,
        uint256 feePercentage,
        address to
    ) public {
        if (boostAmount == 0) boostAmount = 1;

        feePercentage = bound(feePercentage, 0, 1e18);

        safe.deposit(boostAmount, to);

        fei.mint(address(feiCToken), boostAmount);

        booster.setBoostCapForVault(vault, boostAmount);
        booster.setBoostCapForCollateral(asset, boostAmount);

        safe.boost(vault, boostAmount);

        fei.mint(address(vault), donationAmount);

        clerk.setDefaultFeePercentage(feePercentage);

        safe.slurp(vault);

        uint256 protocolFeeAmount = uint256(donationAmount).mulWadDown(feePercentage);

        uint256 safeInterestAmount = donationAmount - protocolFeeAmount;

        uint256 delta = boostAmount + safeInterestAmount;

        assertEq(safe.totalFeiBoosted(), delta);
        assertEq(safe.getTotalFeiBoostedForVault(vault), delta);
        assertEq(vault.assetsOf(address(safe)), delta);
        assertEq(vault.totalAssets(), delta);
        assertEq(feiCToken.borrowBalanceCurrent(address(safe)), boostAmount);

        assertEq(master.totalBoosted(), delta);
        assertEq(master.getTotalBoostedForVault(vault), delta);
        assertEq(master.getTotalBoostedAgainstCollateral(asset), delta);

        assertEq(fei.balanceOf(address(master)), protocolFeeAmount);
    }

    /*///////////////////////////////////////////////////////////////
                             SWEEP TESTS
    //////////////////////////////////////////////////////////////*/

    function testFailSweepVaultShares(address to, uint256 amount) public {
        safe.sweep(to, vault, amount);
    }

    function testFailSweepAssetCToken(address to, uint256 amount) public {
        safe.sweep(to, assetCToken, amount);
    }

    function testSweep(uint256 amount, address to) public {
        fei.mint(address(safe), amount);

        safe.sweep(to, fei, amount);

        assertEq(fei.balanceOf(to), amount);
    }
}
