// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.12;

import "ds-test/test.sol";
import "contracts/options/AssetsRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "contracts/QuantConfig.sol";
import "forge-std/stdlib.sol";
import "forge-std/Vm.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20WithDecimals is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_
    ) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

contract SimpleERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = 18;
    }
}

contract AssetsRegistryTest is DSTest {
    Vm public constant vm = Vm(HEVM_ADDRESS);

    AssetsRegistry public assetsRegistry;

    event AssetAdded(
        address indexed underlying,
        string name,
        string symbol,
        uint8 decimals
    );

    function setUp() public {
        address quantConfig = address(new QuantConfig());
        assetsRegistry = new AssetsRegistry(quantConfig);
        vm.mockCall(
            quantConfig,
            abi.encodeWithSelector(AccessControlUpgradeable.hasRole.selector),
            abi.encode(true)
        );
    }

    function testAddAssetWithOptionalERC20Methods() public {
        string memory name = "BTCB Token";
        string memory symbol = "BTCB";
        uint8 decimals = 18;

        ERC20WithDecimals asset = new ERC20WithDecimals(name, symbol, decimals);

        assertEq(asset.name(), name);
        assertEq(asset.symbol(), symbol);
        assertEq(uint256(asset.decimals()), uint256(decimals));

        vm.expectEmit(true, false, false, true);

        emit AssetAdded(address(asset), name, symbol, decimals);

        assetsRegistry.addAssetWithOptionalERC20Methods(address(asset));

        address registeredAsset = assetsRegistry.registeredAssets(0);
        assertEq(registeredAsset, address(asset));

        (
            string memory registerdName,
            string memory registeredSymbol,
            uint8 registeredDecimals
        ) = assetsRegistry.assetProperties(registeredAsset);

        assertEq(registerdName, name);
        assertEq(registeredSymbol, symbol);
        assertEq(uint256(registeredDecimals), uint256(decimals));
    }

    function testAddAssetWithoutOptionalERC20Methods(
        string memory name,
        string memory symbol
    ) public {
        SimpleERC20 asset = new SimpleERC20(name, symbol);

        // Should revert when trying to call asset.name()
        vm.expectRevert(bytes(""));

        assetsRegistry.addAssetWithOptionalERC20Methods(address(asset));
    }

    function testAddAssetAsNotRegistryMananger() public {
        vm.clearMockedCalls();

        string memory name = "BUSD Token";
        string memory symbol = "BUSD";
        uint8 decimals = 18;

        ERC20WithDecimals asset = new ERC20WithDecimals(name, symbol, decimals);

        vm.expectRevert(
            bytes("AssetsRegistry: only asset registry managers can add assets")
        );

        assetsRegistry.addAssetWithOptionalERC20Methods(address(asset));
    }

    function testAddSameAssetTwice() public {
        string memory name = "Wrapped Ether";
        string memory symbol = "WETH";
        uint8 decimals = 18;

        ERC20WithDecimals asset = new ERC20WithDecimals(name, symbol, decimals);

        assetsRegistry.addAssetWithOptionalERC20Methods(address(asset));

        vm.expectRevert(bytes("AssetsRegistry: asset already added"));

        assetsRegistry.addAssetWithOptionalERC20Methods(address(asset));
    }
}
