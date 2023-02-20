// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.12;

import "ds-test/test.sol";
import {Vm} from "forge-std/Vm.sol";
import {stdCheats} from "forge-std/stdlib.sol";
import {Utils} from "./utils/Utils.sol";
import {ERC20Utils} from "./utils/ERC20Utils.sol";
import {SnapshotComparator} from "./utils/SnapshotUtils.sol";

import {GlobalAccessControl} from "../GlobalAccessControl.sol";

import {CitadelToken} from "../CitadelToken.sol";
import {StakedCitadel} from "../StakedCitadel.sol";
import {StakedCitadelVester} from "../StakedCitadelVester.sol";

import {SupplySchedule} from "../SupplySchedule.sol";
import {CitadelMinter} from "../CitadelMinter.sol";

import {KnightingRound} from "../KnightingRound.sol";
import {Funding} from "../Funding.sol";

import "../interfaces/erc20/IERC20.sol";
import "../interfaces/badger/IEmptyStrategy.sol";
import "../interfaces/citadel/IStakedCitadelLocker.sol";

string constant lockerArtifact = "artifacts-external/StakedCitadelLocker.json";

contract BaseFixture is DSTest, Utils, stdCheats {
    Vm constant vm = Vm(HEVM_ADDRESS);
    ERC20Utils immutable erc20utils = new ERC20Utils();
    SnapshotComparator comparator;

    bytes32 public constant CONTRACT_GOVERNANCE_ROLE =
        keccak256("CONTRACT_GOVERNANCE_ROLE");
    bytes32 public constant TREASURY_GOVERNANCE_ROLE =
        keccak256("TREASURY_GOVERNANCE_ROLE");

    bytes32 public constant TECH_OPERATIONS_ROLE =
        keccak256("TECH_OPERATIONS_ROLE");
    bytes32 public constant POLICY_OPERATIONS_ROLE =
        keccak256("POLICY_OPERATIONS_ROLE");
    bytes32 public constant TREASURY_OPERATIONS_ROLE =
        keccak256("TREASURY_OPERATIONS_ROLE");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    bytes32 public constant BLOCKLIST_MANAGER_ROLE =
        keccak256("BLOCKLIST_MANAGER_ROLE");
    bytes32 public constant BLOCKLISTED_ROLE = keccak256("BLOCKLISTED_ROLE");

    bytes32 public constant CITADEL_MINTER_ROLE =
        keccak256("CITADEL_MINTER_ROLE");

    uint256 public constant ONE = 1 ether;

    // ==================
    // ===== Actors =====
    // ==================

    address immutable governance = getAddress("governance");
    address immutable techOps = getAddress("techOps");
    address immutable policyOps = getAddress("policyOps");
    address immutable guardian = getAddress("guardian");
    address immutable keeper = getAddress("keeper");
    address immutable treasuryVault = getAddress("treasuryVault");
    address immutable treasuryOps = getAddress("treasuryOps");

    address immutable citadelTree = getAddress("citadelTree");

    address immutable rando = getAddress("rando");

    address immutable whale = getAddress("whale");
    address immutable shrimp = getAddress("shrimp");
    address immutable shark = getAddress("shark");

    address immutable eoaOracle = getAddress("eoaOracle");

    address immutable xCitadelStrategy_address = getAddress("xCitadelStrategy");

    address constant wbtc_address = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address constant cvx_address = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;

    IERC20 wbtc = IERC20(wbtc_address);
    IERC20 cvx = IERC20(cvx_address);

    GlobalAccessControl gac = new GlobalAccessControl();

    CitadelToken citadel = new CitadelToken();
    StakedCitadel xCitadel = new StakedCitadel();
    StakedCitadelVester xCitadelVester = new StakedCitadelVester();
    IStakedCitadelLocker xCitadelLocker = IStakedCitadelLocker(deployCode(lockerArtifact));

    SupplySchedule schedule = new SupplySchedule();
    CitadelMinter citadelMinter = new CitadelMinter();

    KnightingRound knightingRound = new KnightingRound();

    Funding fundingWbtc = new Funding();
    Funding fundingCvx = new Funding();

    struct KnightingRoundParams {
        uint256 start;
        uint256 duration;
        uint256 citadelWbtcPrice;
        uint256 wbtcLimit;
    }

    KnightingRoundParams knightingRoundParams;

    function getSelector(string memory _func) public pure returns (bytes4) {
        return bytes4(keccak256(bytes(_func)));
    }

    function setUp() public virtual {
        // Labels
        vm.label(address(this), "this");

        vm.label(governance, "governance");
        vm.label(policyOps, "policyOps");
        vm.label(keeper, "keeper");
        vm.label(guardian, "guardian");
        vm.label(treasuryVault, "treasuryVault");

        vm.label(rando, "rando");

        vm.label(address(schedule), "schedule");
        vm.label(address(gac), "gac");

        vm.label(whale, "whale"); // whale attempts large token actions, testing upper bounds
        vm.label(shrimp, "shrimp"); // shrimp attempts small token actions, testing lower bounds
        vm.label(shark, "shark"); // shark attempts malicious actions

        vm.label(eoaOracle, "eoaOracle"); // oracle EOA for testing oracle-based values simply

        // Initialization
        vm.startPrank(governance);
        gac.initialize(governance);

        uint256[4] memory xCitadelFees = [
            uint256(0),
            uint256(0),
            uint256(0),
            uint256(0)
        ];

        citadel.initialize("Citadel", "CTDL", address(gac));
        xCitadel.initialize(
            address(citadel),
            address(governance),
            address(keeper),
            address(guardian),
            address(treasuryVault),
            address(techOps),
            address(citadelTree),
            address(xCitadelVester),
            "Staked Citadel",
            "xCTDL",
            xCitadelFees
        );

        // vm.etch(xCitadelStrategy_address, staticCode.getEmptyStrategyCode());

        // emit log_address(xCitadelStrategy_address);

        // IEmptyStrategy xCitadelStrategy = IEmptyStrategy(xCitadelStrategy_address);
        // emit log(xCitadelStrategy.getName());
        // xCitadelStrategy.initialize(address(xCitadel), address(citadel));

        // xCitadel.setStrategy(xCitadelStrategy_address);

        xCitadelVester.initialize(
            address(gac),
            address(citadel),
            address(xCitadel)
        );
        xCitadelLocker.initialize(
            address(xCitadel),
            "Vote Locked xCitadel",
            "vlCTDL"
        );

        xCitadelLocker.addReward(address(xCitadel), address(citadelMinter), false);

        schedule.initialize(address(gac));
        citadelMinter.initialize(
            address(gac),
            address(citadel),
            address(xCitadel),
            address(xCitadelLocker),
            address(schedule)
        );

        // // Knighting Round
        knightingRoundParams = KnightingRoundParams({
            start: block.timestamp + 100,
            duration: 7 days,
            citadelWbtcPrice: 21e18, // 21 CTDL per wBTC
            wbtcLimit: 100e8 // 100 wBTC
        });

        knightingRound.initialize(
            address(gac),
            address(citadel),
            address(wbtc),
            knightingRoundParams.start,
            knightingRoundParams.duration,
            knightingRoundParams.citadelWbtcPrice,
            address(governance),
            address(0), // TODO: Add guest list and test with it
            knightingRoundParams.wbtcLimit
        );
        vm.stopPrank();

        // Funding

        fundingWbtc.initialize(
            address(gac),
            address(citadel),
            address(wbtc),
            address(xCitadel),
            treasuryVault,
            eoaOracle,
            100e8
        );
        fundingCvx.initialize(
            address(gac),
            address(citadel),
            address(cvx),
            address(xCitadel),
            treasuryVault,
            eoaOracle,
            100000e18
        );

        // Grant roles
        vm.startPrank(governance);
        gac.grantRole(CONTRACT_GOVERNANCE_ROLE, governance);
        gac.grantRole(TREASURY_GOVERNANCE_ROLE, treasuryVault);

        gac.grantRole(TECH_OPERATIONS_ROLE, techOps);
        gac.grantRole(TREASURY_OPERATIONS_ROLE, treasuryOps);
        gac.grantRole(POLICY_OPERATIONS_ROLE, policyOps);

        gac.grantRole(CITADEL_MINTER_ROLE, address(citadelMinter));
        gac.grantRole(CITADEL_MINTER_ROLE, governance); // To handle initial supply, remove atomically.

        gac.grantRole(PAUSER_ROLE, guardian);
        gac.grantRole(UNPAUSER_ROLE, techOps);
        vm.stopPrank();

        // Deposit initial assets to users
        erc20utils.forceMintTo(whale, wbtc_address, 1000e8);
        erc20utils.forceMintTo(shrimp, wbtc_address, 10e8);
        erc20utils.forceMintTo(shark, wbtc_address, 100e8);

        erc20utils.forceMintTo(whale, cvx_address, 1000000e18);
        erc20utils.forceMintTo(shrimp, cvx_address, 1000e18);
        erc20utils.forceMintTo(shark, cvx_address, 10000e18);

        // Setup balance tracking
        comparator = new SnapshotComparator();

        uint256 numAddressesToTrack = 7;
        address[] memory accounts_to_track = new address[](numAddressesToTrack);
        string[] memory accounts_to_track_names = new string[](
            numAddressesToTrack
        );

        accounts_to_track[0] = whale;
        accounts_to_track_names[0] = "whale";

        accounts_to_track[1] = shrimp;
        accounts_to_track_names[1] = "shrimp";

        accounts_to_track[2] = shark;
        accounts_to_track_names[2] = "shark";

        accounts_to_track[3] = address(knightingRound);
        accounts_to_track_names[3] = "knightingRound";

        accounts_to_track[4] = address(fundingCvx);
        accounts_to_track_names[4] = "fundingCvx";

        accounts_to_track[5] = address(fundingWbtc);
        accounts_to_track_names[5] = "fundingWbtc";

        accounts_to_track[6] = treasuryVault;
        accounts_to_track_names[6] = "treasuryVault";

        // Track balances for all tokens + entities
        for (uint256 i = 0; i < numAddressesToTrack; i++) {
            // wBTC
            string memory wbtc_key = concatenate(
                concatenate("wbtc.balanceOf(", accounts_to_track_names[i]),
                ")"
            );
            comparator.addCall(
                wbtc_key,
                wbtc_address,
                abi.encodeWithSignature(
                    "balanceOf(address)",
                    accounts_to_track[i]
                )
            );

            // Citadel
            string memory citadel_key = concatenate(
                concatenate("citadel.balanceOf(", accounts_to_track_names[i]),
                ")"
            );
            comparator.addCall(
                citadel_key,
                address(citadel),
                abi.encodeWithSignature(
                    "balanceOf(address)",
                    accounts_to_track[i]
                )
            );

            // CVX
            string memory cvx_key = concatenate(
                concatenate("cvx.balanceOf(", accounts_to_track_names[i]),
                ")"
            );
            comparator.addCall(
                cvx_key,
                cvx_address,
                abi.encodeWithSignature(
                    "balanceOf(address)",
                    accounts_to_track[i]
                )
            );

            // xCitadel
            string memory xcitadel_key = concatenate(
                concatenate("xCitadel.balanceOf(", accounts_to_track_names[i]),
                ")"
            );
            comparator.addCall(
                xcitadel_key,
                address(xCitadel),
                abi.encodeWithSignature(
                    "balanceOf(address)",
                    accounts_to_track[i]
                )
            );

            // Knighting Round Purchases
            string memory knighting_round_key = concatenate(
                concatenate(
                    "knightingRound.boughtAmounts(",
                    accounts_to_track_names[i]
                ),
                ")"
            );
            comparator.addCall(
                knighting_round_key,
                address(knightingRound),
                abi.encodeWithSignature(
                    "boughtAmounts(address)",
                    accounts_to_track[i]
                )
            );

            // emit log(wbtc_key);
            // emit log(citadel_key);
        }

        comparator.addCall(
            "citadel.totalSupply()",
            address(citadel),
            abi.encodeWithSignature("totalSupply()")
        );

        comparator.addCall(
            "xCitadel.totalSupply()",
            address(xCitadel),
            abi.encodeWithSignature("totalSupply()")
        );

        comparator.addCall(
            "xCitadel.getPricePerFullShare()",
            address(xCitadel),
            abi.encodeWithSignature("getPricePerFullShare()")
        );

    }

    // @dev simple simulation of knighting round, in order to advance next stages in a 'realistic' manner
    function _knightingRoundSim() internal {
        bytes32[] memory emptyProof = new bytes32[](1);

        // Move to knighting round start
        vm.warp(knightingRound.saleStart());

        // Shrimp BTC
        vm.startPrank(shrimp);
        wbtc.approve(address(knightingRound), wbtc.balanceOf(shrimp));
        knightingRound.buy(wbtc.balanceOf(shrimp) / 2, 0, emptyProof);
        vm.stopPrank();

        // Whale BTC
        vm.startPrank(whale);
        wbtc.approve(address(knightingRound), wbtc.balanceOf(whale));
        knightingRound.buy(wbtc.balanceOf(whale) / 2, 0, emptyProof);
        vm.stopPrank();

        // Knighting round concludes...
        uint timeTillEnd = knightingRoundParams.start + knightingRoundParams.duration - block.timestamp;
        vm.warp(timeTillEnd);
    }

    // @dev run 'launch' multisend operation as a series of calls.
    function _atomicLaunchSim() internal {
        /*
            Prepare for launch (in prod, atomicly via multisend):
            - Mint initial Citadel based on knighting round assets raised
            - Send 60% to knighting round for distribution
            - finalize() KR to get assets
            - LP with 15% of citadel supply + wBTC amount as per initial price
            - Send 25% remaining to treasury vault
            - Initialize and open funding contracts

            [Citadel now has an open market and funding can commence!]
        */

        vm.startPrank(governance);

        uint256 citadelBought = knightingRound.totalTokenOutBought();
        uint256 initialSupply = (citadelBought * 1666666666666666667) / 1e18; // Amount bought = 60% of initial supply, therefore total citadel ~= 1.67 amount bought.

        citadel.mint(governance, initialSupply);
        citadel.transfer(address(knightingRound), citadelBought);

        uint256 remainingSupply = initialSupply - citadelBought - 1e18; // one coin for seeding xCitadel

        citadel.approve(address(xCitadel), 1e18);
        xCitadel.deposit(1e18);

        uint256 toLiquidity = (remainingSupply * 4e17) / 1e18; // 15% of total, or 40% of remaining 40%
        uint256 toTreasury = (remainingSupply * 6e17) / 1e18; // 25% of total, or 60% of remaining 40%

        // TODO: Create curve pool and add liquidity

        citadel.transfer(treasuryVault, toTreasury);

        // Transfer liquidity and remaining assets to treasury
        cvx.transfer(treasuryVault, cvx.balanceOf(governance));
        wbtc.transfer(treasuryVault, wbtc.balanceOf(governance));

        // Set first minting EPOCHS
        gac.revokeRole(CITADEL_MINTER_ROLE, governance); // Remove admin mint, only CitadelMinter rules can mint now

        knightingRound.finalize();
        vm.stopPrank();

        // In a second TX, set the rest of minting epochs in batches, as is possible with gas costs
    }
}
