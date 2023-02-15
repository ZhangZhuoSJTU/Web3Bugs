// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "../interfaces/IOverlayV1Market.sol";
import "../OverlayToken.sol";

contract OverlayV1Mothership is AccessControlEnumerable {

    uint16 public constant MIN_FEE = 1; // 0.01%
    uint16 public constant MAX_FEE = 100; // 1.00%

    uint16 public constant MIN_MARGIN_MAINTENANCE = 100; // 1% maintenance
    uint16 public constant MAX_MARGIN_MAINTENANCE = 6000; // 60% maintenance

    bytes32 public constant ADMIN = 0x00;
    bytes32 public constant GOVERNOR = keccak256("GOVERNOR");
    bytes32 public constant GUARDIAN = keccak256("GUARDIAN");
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant BURNER = keccak256("BURNER");

    // ovl erc20 token
    address public ovl;

    // portion of liquidations to burn on update
    uint public marginBurnRate;

    // global params adjustable by gov
    // build/unwind trading fee
    uint public fee;
    // portion of build/unwind fee burnt
    uint public feeBurnRate;
    // address to send fees to
    address public feeTo;

    mapping(address => bool) public marketActive;
    mapping(address => bool) public marketExists;
    address[] public allMarkets;

    mapping(address => bool) public collateralExists;
    mapping(address => bool) public collateralActive;
    address[] public allCollateral;

    modifier onlyGovernor () {
        require(hasRole(GOVERNOR, msg.sender), "OVLV1:!gov");
        _;
    }

    modifier onlyGuardian () {
        require(hasRole(GUARDIAN, msg.sender), "OVLV1:!guard");
        _;
    }

    constructor(
        address _feeTo,
        uint _fee,
        uint _feeBurnRate,
        uint _marginBurnRate
    ) {

        _setupRole(ADMIN, msg.sender);
        _setupRole(GOVERNOR, msg.sender);
        _setupRole(GUARDIAN, msg.sender);
        _setRoleAdmin(GOVERNOR, ADMIN);
        _setRoleAdmin(GUARDIAN, ADMIN);

        // global params
        fee = _fee;
        feeBurnRate = _feeBurnRate;
        feeTo = _feeTo;
        marginBurnRate = _marginBurnRate;

    }

    function setOVL (address _ovl) external onlyGovernor {

        ovl = _ovl;

    }

    function totalMarkets () external view returns (uint) {
        return allMarkets.length;
    }

    /// @notice Initializes an existing market contract after deployment
    /// @dev Should be called after contract deployment in specific market factory.createMarket
    function initializeMarket(address market) external onlyGovernor {

        require(!marketExists[market], "OVLV1:!!initialized");

        marketExists[market] = true;
        marketActive[market] = true;

        allMarkets.push(market);

    }

    /// @notice Disables an existing market contract for a mirin market
    function disableMarket(address market) external onlyGovernor {

        require(marketActive[market], "OVLV1: !enabled");

        marketActive[market] = false;

    }

    /// @notice Enables an existing market contract for a mirin market
    function enableMarket(address market) external onlyGovernor {

        require(marketExists[market], "OVLV1: !exists");

        require(!marketActive[market], "OVLV1: !disabled");

        marketActive[market] = true;

    }

    function initializeCollateral (address _collateral) external onlyGovernor {

        require(!collateralExists[_collateral], "OVLV1:!!iintialized");

        collateralExists[_collateral] = true;
        collateralActive[_collateral] = true;

        allCollateral.push(_collateral);

        OverlayToken(ovl).grantRole(OverlayToken(ovl).MINTER_ROLE(), _collateral);

        OverlayToken(ovl).grantRole(OverlayToken(ovl).BURNER_ROLE(), _collateral);

    }

    function enableCollateral (address _collateral) external onlyGovernor {

        require(collateralExists[_collateral], "OVLV1:!exists");

        require(!collateralActive[_collateral], "OVLV1:!disabled");

        OverlayToken(ovl).grantRole(OverlayToken(ovl).MINTER_ROLE(), _collateral);

        OverlayToken(ovl).grantRole(OverlayToken(ovl).BURNER_ROLE(), _collateral);

    }

    function disableCollateral (address _collateral) external onlyGovernor {

        require(collateralActive[_collateral], "OVLV1:!enabled");

        OverlayToken(ovl).revokeRole(OverlayToken(ovl).MINTER_ROLE(), _collateral);

        OverlayToken(ovl).revokeRole(OverlayToken(ovl).BURNER_ROLE(), _collateral);

    }

    /// @notice Allows gov to adjust per market params

    /// @notice Allows gov to adjust global params
    function adjustGlobalParams(
        uint16 _fee,
        uint16 _feeBurnRate,
        address _feeTo
    ) external onlyGovernor {
        fee = _fee;
        feeBurnRate = _feeBurnRate;
        feeTo = _feeTo;
    }

    function getUpdateParams() external view returns (
        uint,
        uint,
        address
    ) {
        return (
            marginBurnRate,
            feeBurnRate,
            feeTo
        );
    }

}
