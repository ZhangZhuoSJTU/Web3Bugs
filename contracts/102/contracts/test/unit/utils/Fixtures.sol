// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Core, Vcon, Volt, IERC20} from "../../../core/Core.sol";
import {DSTest} from "./DSTest.sol";
import {Vm} from "./Vm.sol";

struct FeiTestAddresses {
    address userAddress;
    address secondUserAddress;
    address beneficiaryAddress1;
    address beneficiaryAddress2;
    address governorAddress;
    address genesisGroup;
    address keeperAddress;
    address pcvControllerAddress;
    address minterAddress;
    address burnerAddress;
    address guardianAddress;
}

/// @dev Get a list of addresses
function getAddresses() pure returns (FeiTestAddresses memory) {
    FeiTestAddresses memory addresses = FeiTestAddresses({
        userAddress: address(0x1),
        secondUserAddress: address(0x2),
        beneficiaryAddress1: address(0x3),
        beneficiaryAddress2: address(0x4),
        governorAddress: address(0x5),
        genesisGroup: address(0x6),
        keeperAddress: address(0x7),
        pcvControllerAddress: address(0x8),
        minterAddress: address(0x9),
        burnerAddress: address(0x10),
        guardianAddress: address(0x11)
    });

    return addresses;
}

/// @dev Deploy and configure Core
function getCore() returns (Core) {
    address HEVM_ADDRESS = address(
        bytes20(uint160(uint256(keccak256("hevm cheat code"))))
    );
    Vm vm = Vm(HEVM_ADDRESS);
    FeiTestAddresses memory addresses = getAddresses();

    // Deploy Core from Governor address
    vm.startPrank(addresses.governorAddress);
    Core core = new Core();
    core.init();
    Vcon vcon = new Vcon(addresses.governorAddress, addresses.governorAddress);

    core.setVcon(IERC20(address(vcon)));
    core.grantMinter(addresses.minterAddress);
    core.grantBurner(addresses.burnerAddress);
    core.grantPCVController(addresses.pcvControllerAddress);
    core.grantGuardian(addresses.guardianAddress);

    vm.stopPrank();
    return core;
}
