// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {Authority} from "solmate/auth/Auth.sol";
import {ERC4626} from "solmate/mixins/ERC4626.sol";
import {DSTestPlus} from "solmate/test/utils/DSTestPlus.sol";

import {TurboBooster} from "../modules/TurboBooster.sol";

import {TurboSafe} from "../TurboSafe.sol";

contract TurboBoosterTest is DSTestPlus {
    TurboBooster booster;

    function setUp() public {
        booster = new TurboBooster(address(this), Authority(address(0)));
    }

    function testCanSafeBoostVault(
        bool frozen,
        ERC20 collateral,
        uint256 boostCapForCollateral,
        ERC4626 vault,
        uint256 boostCapForVault,
        TurboSafe safe,
        uint256 feiAmount,
        uint256 newTotalBoostedForVault,
        uint256 newTotalBoostedAgainstCollateral
    ) public {
        booster.setFreezeStatus(frozen);
        assertBoolEq(booster.frozen(), frozen);

        booster.setBoostCapForCollateral(collateral, boostCapForCollateral);
        assertEq(booster.getBoostCapForCollateral(collateral), boostCapForCollateral);

        booster.setBoostCapForVault(vault, boostCapForVault);
        assertEq(booster.getBoostCapForVault(vault), boostCapForVault);

        assertBoolEq(
            booster.canSafeBoostVault(
                safe,
                collateral,
                vault,
                feiAmount,
                newTotalBoostedForVault,
                newTotalBoostedAgainstCollateral
            ),
            !frozen &&
                boostCapForCollateral >= newTotalBoostedAgainstCollateral &&
                boostCapForVault >= newTotalBoostedForVault
        );
    }
}
