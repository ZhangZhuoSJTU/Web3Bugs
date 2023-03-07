// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {VRFCoordinatorV2Mock} from "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";
import {VRFCoordinatorV2} from "@chainlink/contracts/src/v0.8/VRFCoordinatorV2.sol";
import {VRFNFTRandomDraw} from "../src/VRFNFTRandomDraw.sol";
import {VRFNFTRandomDrawFactory} from "../src/VRFNFTRandomDrawFactory.sol";

import {IOwnableUpgradeable} from "../src/ownable/IOwnableUpgradeable.sol";

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";

import {IVRFNFTRandomDraw} from "../src/interfaces/IVRFNFTRandomDraw.sol";
import {IVRFNFTRandomDrawFactory} from "../src/interfaces/IVRFNFTRandomDrawFactory.sol";

import {MockNFT} from "./mocks/MockNFT.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract VRFNFTRandomDrawTest is Test {
    MockNFT targetNFT;
    MockNFT drawingNFT;
    MockERC20 linkTokens;
    VRFNFTRandomDrawFactory factory;

    VRFCoordinatorV2Mock mockCoordinator;

    address user = address(0x2134);
    address admin = address(0x0132);

    uint64 subscriptionId;

    VRFNFTRandomDraw currentDraw;

    function setUp() public {
        vm.label(user, "USER");
        vm.label(admin, "ADMIN");

        subscriptionId = 1337;

        targetNFT = new MockNFT("target", "target");
        vm.label(address(targetNFT), "TargetNFT");
        drawingNFT = new MockNFT("drawing", "drawing");
        vm.label(address(drawingNFT), "DrawingNFT");
        linkTokens = new MockERC20("link", "link");
        vm.label(address(linkTokens), "LINK");

        mockCoordinator = new VRFCoordinatorV2Mock(0.1 ether, 1000);

        VRFNFTRandomDraw drawImpl = new VRFNFTRandomDraw(mockCoordinator);
        // Unproxied/unowned factory
        factory = new VRFNFTRandomDrawFactory(address(drawImpl));

        vm.prank(admin);
        subscriptionId = mockCoordinator.createSubscription();
    }

    function test_Version() public {
address sender = address(0x994);
        IVRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = 2 weeks;
        settings.token = address(targetNFT);
        settings.tokenId = 0;
        settings.drawingTokenStartId = 0;
        settings.drawingTokenEndId = 2;
        settings.drawingToken = address(drawingNFT);
        settings.subscriptionId = subscriptionId;

        vm.prank(sender);
        targetNFT.mint();

        vm.prank(sender);
        VRFNFTRandomDraw draw = VRFNFTRandomDraw(factory.makeNewDraw(settings));
        assertEq(draw.contractVersion(), 1);
    }

    function test_InvalidOptionTime() public {
        IVRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 0;
        // invalid time for drawing
        vm.expectRevert(
            IVRFNFTRandomDraw
                .REDRAW_TIMELOCK_NEEDS_TO_BE_MORE_THAN_AN_HOUR
                .selector
        );
        factory.makeNewDraw(settings);

        // fix this issue
        settings.drawBufferTime = 2 hours;
        settings.recoverTimelock = block.timestamp + 1000;
        
        // recovery timelock too soon
        vm.expectRevert(
            IVRFNFTRandomDraw
                .RECOVER_TIMELOCK_NEEDS_TO_BE_AT_LEAST_A_WEEK
                .selector
        );
        factory.makeNewDraw(settings);

        // fix recovery issue
        settings.drawBufferTime = 2 hours;
        settings.recoverTimelock = 2 weeks;
        
        vm.expectRevert(
            abi.encodeWithSelector(IVRFNFTRandomDraw.TOKEN_NEEDS_TO_BE_A_CONTRACT.selector, address(0x0))
        );
        factory.makeNewDraw(settings);
    }

    function test_InvalidRecoverTimelock() public {
        VRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = 1000;
        // recovery timelock too soon
        vm.expectRevert(
            IVRFNFTRandomDraw
                .RECOVER_TIMELOCK_NEEDS_TO_BE_AT_LEAST_A_WEEK
                .selector
        );
        factory.makeNewDraw(settings);
    }

    function test_ZeroTokenContract() public {
        VRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = block.timestamp + 604800;
        // Token is not a contract
        vm.expectRevert(abi.encodeWithSelector(IVRFNFTRandomDraw.TOKEN_NEEDS_TO_BE_A_CONTRACT.selector, address(0x0)));
        factory.makeNewDraw(settings);
    }

    function test_NoTokenOwner() public {
        VRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = 2 weeks;
        settings.token = address(targetNFT);
        settings.drawingTokenStartId = 0;
        settings.drawingTokenEndId = 4;
        settings.drawingToken = address(drawingNFT);

        // recovery timelock too soon
        vm.expectRevert(IVRFNFTRandomDraw.TOKEN_BEING_OFFERED_NEEDS_TO_EXIST.selector);
        factory.makeNewDraw(settings);
    }

    function test_BadDrawingRange() public {
        address sender = address(0x994);
        vm.startPrank(sender);
        IVRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = 2 weeks;
        settings.token = address(targetNFT);
        settings.drawingToken = address(drawingNFT);
        settings.tokenId = 0;
        settings.drawingTokenStartId = 2;
        targetNFT.mint();

        // recovery timelock too soon
        vm.expectRevert(IVRFNFTRandomDraw.DRAWING_TOKEN_RANGE_INVALID.selector);
        factory.makeNewDraw(settings);
    }

    function test_TokenNotApproved() public {
       address sender = address(0x994);
        IVRFNFTRandomDraw.Settings memory settings;
        settings.drawBufferTime = 6000;
        settings.recoverTimelock = 2 weeks;
        settings.token = address(targetNFT);
        settings.tokenId = 0;
        settings.drawingTokenStartId = 0;
        settings.drawingTokenEndId = 2;
        settings.drawingToken = address(drawingNFT);
        settings.subscriptionId = subscriptionId;

        vm.prank(sender);
        targetNFT.mint();

        vm.prank(sender);
        IVRFNFTRandomDraw draw = VRFNFTRandomDraw(factory.makeNewDraw(settings));

        vm.prank(admin);
        mockCoordinator.addConsumer(subscriptionId, address(draw));
        vm.prank(admin);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        // Token needs to be approved
        vm.expectRevert(IVRFNFTRandomDraw.TOKEN_NEEDS_TO_BE_APPROVED_TO_CONTRACT.selector);
        vm.prank(sender);
        draw.startDraw();
    }

    function test_CannotRerollInFlight() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        vm.expectRevert(IVRFNFTRandomDraw.TOKEN_NEEDS_TO_BE_APPROVED_TO_CONTRACT.selector);
        drawing.startDraw();

        targetNFT.setApprovalForAll(consumerAddress, true);

        uint256 drawingId = drawing.startDraw();

        vm.expectRevert(IVRFNFTRandomDraw.REQUEST_IN_FLIGHT.selector);
        drawing.startDraw();
    }


    function test_ValidateRequestID() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        vm.stopPrank();
        vm.prank(consumerAddress);
        uint256 otherRequestId = VRFCoordinatorV2(address(mockCoordinator)).requestRandomWords({
            keyHash: bytes32(0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15),
            subId: subscriptionId,
            requestConfirmations: uint16(1),
            callbackGasLimit: 100000,
            numWords: 3
        });

        vm.startPrank(admin);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        targetNFT.setApprovalForAll(consumerAddress, true);

        uint256 drawingId = drawing.startDraw();

        mockCoordinator.fulfillRandomWords(otherRequestId, consumerAddress);
        (uint256 requestId, bool hasChosenNumber, ) = drawing.getRequestDetails();
        assert(!hasChosenNumber);

        mockCoordinator.fulfillRandomWords(drawingId, consumerAddress);
        (requestId, hasChosenNumber, ) = drawing.getRequestDetails();
        assert(hasChosenNumber);

        assertTrue(drawing.hasUserWon(winner));
    }

    function test_FullDrawing() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        targetNFT.setApprovalForAll(consumerAddress, true);

        uint256 drawingId = drawing.startDraw();

        mockCoordinator.fulfillRandomWords(drawingId, consumerAddress);

        vm.stopPrank();

        assertEq(targetNFT.balanceOf(winner), 0);
        assertEq(targetNFT.balanceOf(consumerAddress), 1);

        // should be able to call nft
        vm.prank(winner);
        drawing.winnerClaimNFT();
        assertEq(targetNFT.balanceOf(winner), 1);
        assertEq(targetNFT.balanceOf(consumerAddress), 0);
    }

    function test_DrawingUserCheck() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        targetNFT.setApprovalForAll(consumerAddress, true);

        uint256 drawingId = drawing.startDraw();

        mockCoordinator.fulfillRandomWords(drawingId, consumerAddress);

        (, , uint256 drawTimelock) = drawing.getRequestDetails();
        assertEq(drawTimelock, 3601);
        assertEq(block.timestamp, 1);

        vm.expectRevert(IVRFNFTRandomDraw.TOO_SOON_TO_REDRAW.selector);
        drawing.redraw();

        vm.warp(2 hours);

        drawingId = drawing.redraw();

        mockCoordinator.fulfillRandomWords(drawingId, consumerAddress);

        vm.warp(30 days);

        assertEq(targetNFT.balanceOf(admin), 0);
        assertEq(targetNFT.balanceOf(consumerAddress), 1);

        drawing.lastResortTimelockOwnerClaimNFT();

        // should be able to call nft
        assertEq(targetNFT.balanceOf(admin), 1);
        assertEq(targetNFT.balanceOf(consumerAddress), 0);
    }

    function test_LoserCannotWithdraw() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        address loser = address(0x019);
        vm.label(loser, "loser");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(loser);
        for (uint256 tokensCount = 0; tokensCount < 80; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        vm.stopPrank();

        vm.prank(loser);
        vm.expectRevert(IVRFNFTRandomDraw.NEEDS_TO_HAVE_CHOSEN_A_NUMBER.selector);
        drawing.winnerClaimNFT();

        vm.prank(admin);
        targetNFT.setApprovalForAll(consumerAddress, true);

        vm.prank(admin);
        uint256 drawingId = drawing.startDraw();

        vm.prank(loser);
        vm.expectRevert();
        drawing.winnerClaimNFT();

        mockCoordinator.fulfillRandomWords(drawingId, consumerAddress);

        vm.prank(loser);
        vm.expectRevert();
        drawing.winnerClaimNFT();

        vm.prank(winner);
        drawing.winnerClaimNFT();

        assertEq(targetNFT.balanceOf(admin), 0);
        assertEq(targetNFT.balanceOf(winner), 1);

        vm.prank(loser);
        vm.expectRevert(IOwnableUpgradeable.ONLY_OWNER.selector);
        drawing.lastResortTimelockOwnerClaimNFT();

        // should be able to call nft
        assertEq(targetNFT.balanceOf(admin), 0);
        assertEq(targetNFT.balanceOf(winner), 1);
    }

    function test_NFTNotApproved() public {
        address winner = address(0x1337);
        vm.label(winner, "winner");

        vm.startPrank(winner);
        for (uint256 tokensCount = 0; tokensCount < 10; tokensCount++) {
            drawingNFT.mint();
        }
        vm.stopPrank();

        vm.startPrank(admin);
        targetNFT.mint();

        address consumerAddress = factory.makeNewDraw(
            IVRFNFTRandomDraw.Settings({
                token: address(targetNFT),
                tokenId: 0,
                drawingToken: address(drawingNFT),
                drawingTokenStartId: 0,
                drawingTokenEndId: 10,
                drawBufferTime: 1 hours,
                recoverTimelock: 2 weeks,
                keyHash: bytes32(
                    0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15
                ),
                subscriptionId: subscriptionId
            })
        );
        vm.label(consumerAddress, "drawing instance");

        mockCoordinator.addConsumer(subscriptionId, consumerAddress);
        mockCoordinator.fundSubscription(subscriptionId, 100 ether);

        VRFNFTRandomDraw drawing = VRFNFTRandomDraw(consumerAddress);

        vm.expectRevert();
        uint256 drawingId = drawing.startDraw();
    }
}
