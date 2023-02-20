// SPDX-License-Identifier: None
// Copyright (c) 2022 Trader Joe - All rights reserved

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IRocketJoeFactory.sol";
import "./interfaces/IJoeFactory.sol";
import "./interfaces/IJoePair.sol";
import "./interfaces/ILaunchEvent.sol";
import "./interfaces/IRocketJoeToken.sol";

/// @title Rocket Joe Factory
/// @author Trader Joe
/// @notice Factory that creates Rocket Joe events
contract RocketJoeFactory is IRocketJoeFactory, Ownable {
    address public override penaltyCollector;
    address public override eventImplementation;

    address public override rJoe;
    uint256 public override rJoePerAvax;
    address public override wavax;
    address public override router;
    address public override factory;

    uint256 public override PHASE_ONE_DURATION = 2 days;
    uint256 public override PHASE_ONE_NO_FEE_DURATION = 1 days;
    uint256 public override PHASE_TWO_DURATION = 1 days;

    mapping(address => address) public override getRJLaunchEvent;
    mapping(address => bool) public override isRJLaunchEvent;
    address[] public override allRJLaunchEvents;

    /// @notice Creates the launch event factory
    /// @dev Uses clone factory pattern to save space
    /// @param _eventImplementation Implementation of launch event contract
    /// @param _rJoe rJOE token address
    /// @param _wavax WAVAX token address
    /// @param _penaltyCollector Address that collects all withdrawal penalties
    /// @param _router Router used to create LP on Trader Joe AMM
    /// @param _factory Factory used to get info of JoePairs
    constructor(
        address _eventImplementation,
        address _rJoe,
        address _wavax,
        address _penaltyCollector,
        address _router,
        address _factory
    ) {
        require(
            _eventImplementation != address(0) &&
                _rJoe != address(0) &&
                _wavax != address(0) &&
                _penaltyCollector != address(0) &&
                _router != address(0) &&
                _factory != address(0),
            "RJFactory: Addresses can't be null address"
        );
        IRocketJoeToken(_rJoe).initialize();

        eventImplementation = _eventImplementation;
        rJoe = _rJoe;

        wavax = _wavax;
        penaltyCollector = _penaltyCollector;
        router = _router;
        factory = _factory;
        rJoePerAvax = 100;
    }

    /// @notice Returns the number of launch events
    /// @return The number of launch events ever created
    function numLaunchEvents() external view override returns (uint256) {
        return allRJLaunchEvents.length;
    }

    /// @notice Creates a launch event contract
    /// @param _issuer Address of the project issuing tokens for auction
    /// @param _phaseOneStartTime Timestamp of when launch event will start
    /// @param _token Token that will be issued through this launch event
    /// @param _tokenAmount Amount of tokens that will be issued
    /// @param _tokenIncentivesPercent Additional tokens that will be given as
    /// incentive for locking up LPs during phase 3 expressed as a percentage
    /// of the issuing tokens for sale, scaled to 1e18
    /// @param _floorPrice Price of each token in AVAX, scaled to 1e18
    /// @param _maxWithdrawPenalty Maximum withdrawal penalty that can be met
    /// during phase 1
    /// @param _fixedWithdrawPenalty Withdrawal penalty during phase 2
    /// @param _maxAllocation Maximum number of AVAX each participant can commit
    /// @param _userTimelock Amount of time users' LPs will be locked for
    /// during phase 3
    /// @param _issuerTimelock Amount of time issuer's LP will be locked for
    /// during phase 3
    /// @return Address of launch event contract
    function createRJLaunchEvent(
        address _issuer,
        uint256 _phaseOneStartTime,
        address _token,
        uint256 _tokenAmount,
        uint256 _tokenIncentivesPercent,
        uint256 _floorPrice,
        uint256 _maxWithdrawPenalty,
        uint256 _fixedWithdrawPenalty,
        uint256 _maxAllocation,
        uint256 _userTimelock,
        uint256 _issuerTimelock
    ) external override returns (address) {
        require(
            getRJLaunchEvent[_token] == address(0),
            "RJFactory: token has already been issued"
        );
        require(_issuer != address(0), "RJFactory: issuer can't be 0 address");
        require(_token != address(0), "RJFactory: token can't be 0 address");
        require(_token != wavax, "RJFactory: token can't be wavax");
        require(
            _tokenAmount > 0,
            "RJFactory: token amount needs to be greater than 0"
        );
        require(
            IJoeFactory(factory).getPair(_token, wavax) == address(0) ||
                IJoePair(IJoeFactory(factory).getPair(_token, wavax))
                    .totalSupply() ==
                0,
            "RJFactory: liquid pair already exists"
        );

        address launchEvent = Clones.clone(eventImplementation);

        // msg.sender needs to approve RocketJoeFactory
        IERC20(_token).transferFrom(msg.sender, launchEvent, _tokenAmount);

        ILaunchEvent(payable(launchEvent)).initialize(
            _issuer,
            _phaseOneStartTime,
            _token,
            _tokenIncentivesPercent,
            _floorPrice,
            _maxWithdrawPenalty,
            _fixedWithdrawPenalty,
            _maxAllocation,
            _userTimelock,
            _issuerTimelock
        );

        getRJLaunchEvent[_token] = launchEvent;
        isRJLaunchEvent[launchEvent] = true;
        allRJLaunchEvents.push(launchEvent);

        _emitLaunchedEvent(_issuer, _token, _phaseOneStartTime);

        return launchEvent;
    }

    /// @notice Set rJOE address
    /// @param _rJoe New rJOE address
    function setRJoe(address _rJoe) external override onlyOwner {
        IRocketJoeToken(_rJoe).initialize();
        rJoe = _rJoe;
        emit SetRJoe(_rJoe);
    }

    /// @notice Set address to collect withdrawal penalties
    /// @param _penaltyCollector New penalty collector address
    function setPenaltyCollector(address _penaltyCollector)
        external
        override
        onlyOwner
    {
        penaltyCollector = _penaltyCollector;
        emit SetPenaltyCollector(_penaltyCollector);
    }

    /// @notice Set JoeRouter address
    /// @param _router New router address
    function setRouter(address _router) external override onlyOwner {
        router = _router;
        emit SetRouter(_router);
    }

    /// @notice Set JoeFactory address
    /// @param _factory New factory address
    function setFactory(address _factory) external override onlyOwner {
        factory = _factory;
        emit SetFactory(_factory);
    }

    /// @notice Set amount of rJOE required to deposit 1 AVAX into launch event
    /// @dev Configured by team between launch events to control inflation
    function setRJoePerAvax(uint256 _rJoePerAvax) external override onlyOwner {
        rJoePerAvax = _rJoePerAvax;
        emit SetRJoePerAvax(_rJoePerAvax);
    }

    /// @notice Set duration of each of the three phases
    /// @param _phaseNumber Can be only 1 or 2
    /// @param _duration Duration of phase in seconds
    function setPhaseDuration(uint256 _phaseNumber, uint256 _duration)
        external
        override
        onlyOwner
    {
        if (_phaseNumber == 1) {
            require(
                _duration > PHASE_ONE_NO_FEE_DURATION,
                "RJFactory: phase one duration lower than no fee duration"
            );
            PHASE_ONE_DURATION = _duration;
        } else if (_phaseNumber == 2) {
            PHASE_TWO_DURATION = _duration;
        }
    }

    /// @notice Set the no fee duration of phase 1
    /// @param _noFeeDuration Duration of no fee phase
    function setPhaseOneNoFeeDuration(uint256 _noFeeDuration)
        external
        override
        onlyOwner
    {
        require(
            _noFeeDuration < PHASE_ONE_DURATION,
            "RJFactory: no fee duration bigger than phase one duration"
        );
        PHASE_ONE_NO_FEE_DURATION = _noFeeDuration;
    }

    /// @dev This function emits an event after a new launch event has been created
    /// It is only seperated out due to `createRJLaunchEvent` having too many local variables
    function _emitLaunchedEvent(
        address _issuer,
        address _token,
        uint256 _phaseOneStartTime
    ) internal {
        uint256 _phaseTwoStartTime = _phaseOneStartTime + PHASE_ONE_DURATION;
        uint256 _phaseThreeStartTime = _phaseTwoStartTime + PHASE_TWO_DURATION;

        emit RJLaunchEventCreated(
            _issuer,
            _token,
            _phaseOneStartTime,
            _phaseTwoStartTime,
            _phaseThreeStartTime,
            rJoe,
            rJoePerAvax
        );
    }
}
