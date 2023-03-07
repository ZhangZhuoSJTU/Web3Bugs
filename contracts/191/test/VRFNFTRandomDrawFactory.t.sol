// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {VRFCoordinatorV2Mock} from "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";
import {VRFCoordinatorV2} from "@chainlink/contracts/src/v0.8/VRFCoordinatorV2.sol";
import {VRFNFTRandomDraw} from "../src/VRFNFTRandomDraw.sol";
import {VRFNFTRandomDrawFactory} from "../src/VRFNFTRandomDrawFactory.sol";

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";

import {IVRFNFTRandomDraw} from "../src/interfaces/IVRFNFTRandomDraw.sol";
import {IVRFNFTRandomDrawFactory} from "../src/interfaces/IVRFNFTRandomDrawFactory.sol";
import {VRFNFTRandomDrawFactoryProxy} from "../src/VRFNFTRandomDrawFactoryProxy.sol";

import {IOwnableUpgradeable} from "../src/ownable/IOwnableUpgradeable.sol";

contract VRFNFTRandomDrawFactoryTest is Test {
    function testFactoryInitializeConstructor() public {
        address mockImplAddress = address(0x123);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            (mockImplAddress)
        );
        vm.expectRevert();
        factory.initialize(address(0x222));
        assertEq(IOwnableUpgradeable(address(factory)).owner(), address(0x0));
    }
    function testFactoryDoesNotAllowZeroAddressInitalization() public {
        vm.expectRevert(IVRFNFTRandomDrawFactory.IMPL_ZERO_ADDRESS_NOT_ALLOWED.selector);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            address(0)
        );
    }

    function testFactoryVersion() public {
        address mockImplAddress = address(0x123);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            (mockImplAddress)
        );
        assertEq(factory.contractVersion(), 1);
    }

    function testFactoryInitializeProxy() public {
        address mockImplAddress = address(0x123);
        address defaultOwnerAddress = address(0x222);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            address(mockImplAddress)
        );

        VRFNFTRandomDrawFactoryProxy proxy = new VRFNFTRandomDrawFactoryProxy(
            address(factory),
            defaultOwnerAddress
        );
        assertEq(
            IOwnableUpgradeable(address(proxy)).owner(),
            defaultOwnerAddress
        );
    }

    function testFactoryAttemptsToSetupChildContract() public { 
        address mockImplAddress = address(0x123);
        address defaultOwnerAddress = address(0x222);
        address newCreatorAddress = address(0x2312);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            address(mockImplAddress)
        );

        VRFNFTRandomDrawFactoryProxy proxy = new VRFNFTRandomDrawFactoryProxy(
            address(factory),
            defaultOwnerAddress
        );
        vm.startPrank(newCreatorAddress);
        // While these address aren't correct they are only validated on init not creation.
        address result = IVRFNFTRandomDrawFactory(address(proxy)).makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(0),
                tokenId: 0,
                drawingToken: address(0),
                drawingTokenStartId: 0,
                drawingTokenEndId: 0,
                drawBufferTime: 0,
                recoverTimelock: 0,
                keyHash: bytes32(0),
                subscriptionId: 0
            })
        );
    }

    function testFactoryUpgrade() public {
        address mockChainlinkImplAddress = address(0x123);
        address defaultOwnerAddress = address(0x222);
        address newOwnerAddress = address(0x2199);
        VRFNFTRandomDrawFactory factory = new VRFNFTRandomDrawFactory(
            address(mockChainlinkImplAddress)
        );

        VRFNFTRandomDrawFactoryProxy proxy = new VRFNFTRandomDrawFactoryProxy(
            address(factory),
            defaultOwnerAddress
        );
        VRFNFTRandomDrawFactory factoryAccess = VRFNFTRandomDrawFactory(address(proxy));
        vm.expectRevert();
        factoryAccess.safeTransferOwnership(newOwnerAddress);

        vm.prank(defaultOwnerAddress);
        factoryAccess.safeTransferOwnership(newOwnerAddress);

        vm.startPrank(newOwnerAddress);
        factoryAccess.acceptOwnership();
        assertEq(factoryAccess.owner(), newOwnerAddress);
        address badNewImpl = address(0x1111);
        // Fails with a bad new impl address
        vm.expectRevert();
        factoryAccess.upgradeTo(badNewImpl);
        address newImpl = address(new VRFNFTRandomDrawFactory(address(mockChainlinkImplAddress)));
        factoryAccess.upgradeTo(newImpl);
        vm.stopPrank();

        address newImpl2 = address(new VRFNFTRandomDrawFactory(address(mockChainlinkImplAddress)));
        vm.prank(defaultOwnerAddress);
        vm.expectRevert();
        factoryAccess.upgradeTo(newImpl2);
    }

}
