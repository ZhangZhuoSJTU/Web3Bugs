// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../interfaces/IOverlayV1Mothership.sol";
import "../interfaces/IOverlayToken.sol";
import "../interfaces/IOverlayTokenNew.sol";
import "./OverlayV1Comptroller.sol";
import "./OverlayV1OI.sol";
import "./OverlayV1PricePoint.sol";

abstract contract OverlayV1Governance is
    OverlayV1Comptroller,
    OverlayV1OI,
    OverlayV1PricePoint {

    uint constant private ONE = 1e18;

    bytes32 constant private COLLATERAL = keccak256("COLLATERAL");
    bytes32 constant private GOVERNOR = keccak256("GOVERNOR");
    bytes32 constant private MARKET = keccak256("MARKET");

    address public immutable ovl;

    IOverlayV1Mothership public immutable mothership;

    uint256 public leverageMax;

    mapping (address => bool) public isCollateral;

    modifier onlyCollateral () {
        require(isCollateral[msg.sender], "OVLV1:!collateral");
        _;
    }

    modifier onlyGovernor () {
        require(mothership.hasRole(GOVERNOR, msg.sender), "OVLV1:!governor");
        _;
    }

    modifier enabled() {
        require(mothership.hasRole(MARKET, address(this)), "OVLV1:!enabled");
        _;
    }

    constructor(
        address _mothership
    ) {

        mothership = IOverlayV1Mothership(_mothership);
        ovl = address(IOverlayV1Mothership(_mothership).ovl());

    }

    function addCollateral (address _collateral) public onlyGovernor {

        isCollateral[_collateral] = true;

    }

    function removeCollateral (address _collateral) public onlyGovernor {

        isCollateral[_collateral] = false;

    }

    function setEverything (
        uint256 _k,
        uint256 _pbnj,
        uint256 _compoundPeriod,
        uint256 _lmbda,
        uint256 _staticCap,
        uint256 _brrrrdExpected,
        uint256 _brrrrdWindowMacro,
        uint256 _brrrrdWindowMicro
    ) public onlyGovernor {

        setK(_k);

        setSpread(_pbnj);

        setPeriods(
            _compoundPeriod
        );

        setComptrollerParams(
            _lmbda,
            _staticCap,
            _brrrrdExpected,
            _brrrrdWindowMacro,
            _brrrrdWindowMicro
        );

    }

    function setSpread(
        uint256 _pbnj
    ) public onlyGovernor {

        pbnj = _pbnj;

    }

    function setK (
        uint256 _k
    ) public onlyGovernor {
        k = _k;
    }

    function setPeriods(
        uint256 _compoundingPeriod
    ) public onlyGovernor {

        compoundingPeriod = _compoundingPeriod;

    }

    function setComptrollerParams (
        uint256 _lmbda,
        uint256 _staticCap,
        uint256 _brrrrExpected,
        uint256 _brrrrdWindowMacro,
        uint256 _brrrrdWindowMicro
    ) public onlyGovernor {

        lmbda = _lmbda;
        staticCap = _staticCap;
        brrrrdExpected = _brrrrExpected;
        brrrrdWindowMacro = _brrrrdWindowMacro;
        brrrrdWindowMicro = _brrrrdWindowMicro;

    }

}
