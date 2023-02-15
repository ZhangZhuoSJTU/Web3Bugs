// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {Authority} from "solmate/auth/Auth.sol";
import {DSTestPlus} from "solmate/test/utils/DSTestPlus.sol";
import {MockERC20} from "solmate/test/utils/mocks/MockERC20.sol";

import {MockCToken} from "./mocks/MockCToken.sol";
import {MockPriceFeed} from "./mocks/MockPriceFeed.sol";
import {MockFuseAdmin} from "./mocks/MockFuseAdmin.sol";
import {MockComptroller} from "./mocks/MockComptroller.sol";

import {TurboClerk} from "../modules/TurboClerk.sol";
import {TurboBooster} from "../modules/TurboBooster.sol";

import {TurboSafe} from "../TurboSafe.sol";
import {TurboMaster} from "../TurboMaster.sol";

contract TurboMasterTest is DSTestPlus {
    TurboMaster master;

    MockFuseAdmin fuseAdmin;

    MockComptroller comptroller;

    MockERC20 fei;

    MockERC20 asset;

    MockCToken mockCToken;

    function setUp() public {
        fei = new MockERC20("Fei USD", "FEI", 18);

        asset = new MockERC20("Mock Token", "MOCK", 18);

        fuseAdmin = new MockFuseAdmin();

        comptroller = new MockComptroller(address(fuseAdmin), new MockPriceFeed());

        master = new TurboMaster(comptroller, fei, address(this), Authority(address(0)));

        assertEq(master.getAllSafes().length, 1);
    }

    /*///////////////////////////////////////////////////////////////
                     MODULE CONFIGURATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testSetBooster(TurboBooster booster) public {
        master.setBooster(booster);

        assertEq(address(master.booster()), address(booster));
    }

    function testSetClerk(TurboClerk clerk) public {
        master.setClerk(clerk);

        assertEq(address(master.clerk()), address(clerk));
    }

    /*///////////////////////////////////////////////////////////////
                 DEFAULT AUTHORITY CONFIGURATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testSetDefaultSafeAuthority(Authority authority) public {
        master.setDefaultSafeAuthority(authority);

        assertEq(address(master.defaultSafeAuthority()), address(authority));
    }

    function testCreateSafeWithCustomDefaultSafeAuthority(Authority defaultSafeAuthority) public {
        master.setDefaultSafeAuthority(defaultSafeAuthority);

        comptroller.mapUnderlyingToCToken(asset, new MockCToken(asset));

        (TurboSafe safe, ) = master.createSafe(asset);

        assertEq(address(safe.authority()), address(defaultSafeAuthority));
    }

    /*///////////////////////////////////////////////////////////////
                        SAFE CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testFailCreateWithNoCTokenMapped() public {
        master.createSafe(asset);
    }

    function testFailCreateSafeWithInvalidAsset(ERC20 invalidAsset) public {
        if (invalidAsset == asset) revert();

        comptroller.mapUnderlyingToCToken(invalidAsset, new MockCToken(invalidAsset));

        master.createSafe(invalidAsset);
    }

    function testCreateSafe() public {
        comptroller.mapUnderlyingToCToken(asset, new MockCToken(asset));
        (TurboSafe safe, uint256 id) = master.createSafe(asset);

        assertEq(address(safe.asset()), address(asset));
        assertEq(safe.owner(), address(this));
        assertEq(id, 1);

        assertEq(address(master.safes(1)), address(safe));
        assertEq(master.getAllSafes().length, 2);

        assertTrue(fuseAdmin.isWhitelisted(address(safe)));
    }
}
