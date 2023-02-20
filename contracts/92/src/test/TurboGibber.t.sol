// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {Authority} from "solmate/auth/Auth.sol";
import {ERC4626} from "solmate/mixins/ERC4626.sol";
import {DSTestPlus} from "solmate/test/utils/DSTestPlus.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626} from "solmate/test/utils/mocks/MockERC4626.sol";
import {MockAuthority} from "solmate/test/utils/mocks/MockAuthority.sol";
import {FixedPointMathLib} from "solmate/utils/FixedPointMathLib.sol";

import {MockCToken} from "./mocks/MockCToken.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";
import {MockFuseAdmin} from "./mocks/MockFuseAdmin.sol";
import {MockComptroller} from "./mocks/MockComptroller.sol";

import {TurboClerk} from "../modules/TurboClerk.sol";
import {TurboGibber} from "../modules/TurboGibber.sol";
import {TurboBooster} from "../modules/TurboBooster.sol";

import {TurboSafe} from "../TurboSafe.sol";
import {TurboMaster} from "../TurboMaster.sol";

contract TurboGibberTest is DSTestPlus {
    using FixedPointMathLib for uint256;

    TurboMaster master;

    TurboBooster booster;

    TurboGibber gibber;

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

        comptroller = new MockComptroller(address(fuseAdmin), new MockPriceFeed());

        master = new TurboMaster(comptroller, fei, address(this), new MockAuthority(true));

        assetCToken = new MockCToken(asset);

        comptroller.mapUnderlyingToCToken(asset, assetCToken);

        feiCToken = new MockCToken(fei);

        comptroller.mapUnderlyingToCToken(fei, feiCToken);

        vault = new MockERC4626(fei, "Mock Fei Vault", "mvFEI");

        master.setBooster(booster);

        (safe, ) = master.createSafe(asset);

        asset.mint(address(this), type(uint256).max);
        asset.approve(address(safe), type(uint256).max);

        gibber = new TurboGibber(master, address(this), Authority(address(0)));
    }

    /*///////////////////////////////////////////////////////////////
                             IMPOUND TESTS
    //////////////////////////////////////////////////////////////*/

    function testImpound(
        uint128 depositAmount,
        uint128 borrowAmount,
        uint128 feiAmount,
        uint128 assetAmount,
        address to
    ) public {
        if (depositAmount == 0) depositAmount = 1;
        if (borrowAmount == 0) borrowAmount = 1;
        if (feiAmount == 0) feiAmount = 1;
        if (assetAmount == 0) assetAmount = 1;

        feiAmount = uint128(bound(feiAmount, 0, borrowAmount));
        assetAmount = uint128(bound(assetAmount, 0, depositAmount));

        safe.deposit(depositAmount, to);

        fei.mint(address(feiCToken), borrowAmount);

        booster.setBoostCapForVault(vault, borrowAmount);
        booster.setBoostCapForCollateral(asset, borrowAmount);

        safe.boost(vault, borrowAmount);

        uint256 preBal = asset.balanceOf(to);

        gibber.impound(safe, feiAmount, assetAmount, to);

        assertEq(feiCToken.borrowBalanceCurrent(address(safe)), borrowAmount - feiAmount);
        assertEq(asset.balanceOf(to), preBal + assetAmount);
        assertEq(safe.assetsOf(address(to)), depositAmount - assetAmount);
    }

    /*///////////////////////////////////////////////////////////////
                          IMPOUND ALL TESTS
    //////////////////////////////////////////////////////////////*/

    function testImpoundAll(
        uint128 depositAmount,
        uint128 borrowAmount,
        address to
    ) public {
        if (depositAmount == 0) depositAmount = 1;
        if (borrowAmount == 0) borrowAmount = 1;

        safe.deposit(depositAmount, to);

        fei.mint(address(feiCToken), borrowAmount);

        booster.setBoostCapForVault(vault, borrowAmount);
        booster.setBoostCapForCollateral(asset, borrowAmount);

        safe.boost(vault, borrowAmount);

        uint256 preBal = asset.balanceOf(to);

        gibber.impoundAll(safe, to);

        assertEq(feiCToken.borrowBalanceCurrent(address(safe)), 0);
        assertEq(asset.balanceOf(to), preBal + depositAmount);
        assertEq(safe.assetsOf(address(to)), 0);
    }
}
