// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../libraries/WadRayMath.sol";
import "../interfaces/IConfigProvider.sol";
import "../interfaces/IAddressProvider.sol";

contract ConfigProvider is IConfigProvider {
  IAddressProvider public override a;

  mapping(uint256 => CollateralConfig) private _collateralConfigs; //indexing starts at 1
  mapping(address => uint256) public override collateralIds;

  uint256 public override numCollateralConfigs;
  /// @notice The minimum duration of voting on a proposal, in seconds
  uint256 public override minVotingPeriod = 3 days;
  /// @notice The max duration of voting on a proposal, in seconds
  uint256 public override maxVotingPeriod = 2 weeks;
  /// @notice The percentage of votes in support of a proposal required in order for a quorum to be reached and for a proposal to succeed
  uint256 public override votingQuorum = 1e16; // 1%
  /// @notice The percentage of votes required in order for a voter to become a proposer
  uint256 public override proposalThreshold = 2e14; // 0.02%

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));

    a = _addresses;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  /**
    Creates or overwrites an existing config for a collateral type
    @param _collateralType address of the collateral type
    @param _debtLimit the debt ceiling for the collateral type
    @param _liquidationRatio the minimum ratio to maintain to avoid liquidation
    @param _minCollateralRatio the minimum ratio to maintain to borrow new money or withdraw collateral
    @param _borrowRate the borrowing rate specified in 1 second interval in RAY accuracy.
    @param _originationFee an optional origination fee for newly created debt. Can be 0.
    @param _liquidationBonus the liquidation bonus to be paid to liquidators.
    @param _liquidationFee an optional fee for liquidation debt. Can be 0.
  */
  function setCollateralConfig(
    address _collateralType,
    uint256 _debtLimit,
    uint256 _liquidationRatio,
    uint256 _minCollateralRatio,
    uint256 _borrowRate,
    uint256 _originationFee,
    uint256 _liquidationBonus,
    uint256 _liquidationFee
  ) public override onlyManager {
    require(address(_collateralType) != address(0));
    require(_minCollateralRatio >= _liquidationRatio);
    if (collateralIds[_collateralType] == 0) {
      // Initialize new collateral
      a.core().state().initializeRates(_collateralType);
      CollateralConfig memory config = CollateralConfig({
        collateralType: _collateralType,
        debtLimit: _debtLimit,
        liquidationRatio: _liquidationRatio,
        minCollateralRatio: _minCollateralRatio,
        borrowRate: _borrowRate,
        originationFee: _originationFee,
        liquidationBonus: _liquidationBonus,
        liquidationFee: _liquidationFee
      });

      numCollateralConfigs++;
      _collateralConfigs[numCollateralConfigs] = config;
      collateralIds[_collateralType] = numCollateralConfigs;
    } else {
      // Update collateral config
      a.core().state().refreshCollateral(_collateralType);
      uint256 id = collateralIds[_collateralType];

      _collateralConfigs[id].collateralType = _collateralType;
      _collateralConfigs[id].debtLimit = _debtLimit;
      _collateralConfigs[id].liquidationRatio = _liquidationRatio;
      _collateralConfigs[id].minCollateralRatio = _minCollateralRatio;
      _collateralConfigs[id].borrowRate = _borrowRate;
      _collateralConfigs[id].originationFee = _originationFee;
      _collateralConfigs[id].liquidationBonus = _liquidationBonus;
      _collateralConfigs[id].liquidationFee = _liquidationFee;
    }
    emit CollateralUpdated(
      _collateralType,
      _debtLimit,
      _liquidationRatio,
      _minCollateralRatio,
      _borrowRate,
      _originationFee,
      _liquidationBonus,
      _liquidationFee
    );
  }

  function _emitUpdateEvent(address _collateralType) internal {
    emit CollateralUpdated(
      _collateralType,
      _collateralConfigs[collateralIds[_collateralType]].debtLimit,
      _collateralConfigs[collateralIds[_collateralType]].liquidationRatio,
      _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio,
      _collateralConfigs[collateralIds[_collateralType]].borrowRate,
      _collateralConfigs[collateralIds[_collateralType]].originationFee,
      _collateralConfigs[collateralIds[_collateralType]].liquidationBonus,
      _collateralConfigs[collateralIds[_collateralType]].liquidationFee
    );
  }

  /**
    Remove the config for a collateral type
    @param _collateralType address of the collateral type
  */
  function removeCollateral(address _collateralType) public override onlyManager {
    uint256 id = collateralIds[_collateralType];
    require(id != 0, "collateral does not exist");

    _collateralConfigs[id] = _collateralConfigs[numCollateralConfigs]; //move last entry forward
    collateralIds[_collateralConfigs[id].collateralType] = id; //update id for last entry
    delete _collateralConfigs[numCollateralConfigs]; // delete last entry
    delete collateralIds[_collateralType];

    numCollateralConfigs--;

    emit CollateralRemoved(_collateralType);
  }

  /**
    Sets the debt limit for a collateral type
    @param _collateralType address of the collateral type
    @param _debtLimit the new debt limit
  */
  function setCollateralDebtLimit(address _collateralType, uint256 _debtLimit) public override onlyManager {
    _collateralConfigs[collateralIds[_collateralType]].debtLimit = _debtLimit;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the minimum liquidation ratio for a collateral type
    @dev this is the liquidation treshold under which a vault is considered open for liquidation.
    @param _collateralType address of the collateral type
    @param _liquidationRatio the new minimum collateralization ratio
  */
  function setCollateralLiquidationRatio(address _collateralType, uint256 _liquidationRatio)
    public
    override
    onlyManager
  {
    require(_liquidationRatio <= _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio);
    _collateralConfigs[collateralIds[_collateralType]].liquidationRatio = _liquidationRatio;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the minimum ratio for a collateral type for new borrowing or collateral withdrawal
    @param _collateralType address of the collateral type
    @param _minCollateralRatio the new minimum open ratio
  */
  function setCollateralMinCollateralRatio(address _collateralType, uint256 _minCollateralRatio)
    public
    override
    onlyManager
  {
    require(_minCollateralRatio >= _collateralConfigs[collateralIds[_collateralType]].liquidationRatio);
    _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio = _minCollateralRatio;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the borrowing rate for a collateral type
    @dev borrowing rate is specified for a 1 sec interval and accurancy is in RAY.
    @param _collateralType address of the collateral type
    @param _borrowRate the new borrowing rate for a 1 sec interval
  */
  function setCollateralBorrowRate(address _collateralType, uint256 _borrowRate) public override onlyManager {
    a.core().state().refreshCollateral(_collateralType);
    _collateralConfigs[collateralIds[_collateralType]].borrowRate = _borrowRate;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the origiation fee for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
    @param _originationFee new origination fee in WAD
  */
  function setCollateralOriginationFee(address _collateralType, uint256 _originationFee) public override onlyManager {
    _collateralConfigs[collateralIds[_collateralType]].originationFee = _originationFee;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the liquidation bonus for a collateral type
    @dev the liquidation bonus is specified in WAD
    @param _collateralType address of the collateral type
    @param _liquidationBonus the liquidation bonus to be paid to liquidators.
  */
  function setCollateralLiquidationBonus(address _collateralType, uint256 _liquidationBonus)
    public
    override
    onlyManager
  {
    _collateralConfigs[collateralIds[_collateralType]].liquidationBonus = _liquidationBonus;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the liquidation fee for a collateral type
    @dev this rate is applied as a fee for liquidation and is specified in WAD
    @param _collateralType address of the collateral type
    @param _liquidationFee new liquidation fee in WAD
  */
  function setCollateralLiquidationFee(address _collateralType, uint256 _liquidationFee) public override onlyManager {
    require(_liquidationFee < 1e18); // fee < 100%
    _collateralConfigs[collateralIds[_collateralType]].liquidationFee = _liquidationFee;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Set the min voting period for a gov proposal.
    @param _minVotingPeriod the min voting period for a gov proposal
  */
  function setMinVotingPeriod(uint256 _minVotingPeriod) public override onlyManager {
    minVotingPeriod = _minVotingPeriod;
  }

  /**
    Set the max voting period for a gov proposal.
    @param _maxVotingPeriod the max voting period for a gov proposal
  */
  function setMaxVotingPeriod(uint256 _maxVotingPeriod) public override onlyManager {
    maxVotingPeriod = _maxVotingPeriod;
  }

  /**
    Set the voting quora for a gov proposal.
    @param _votingQuorum the voting quora for a gov proposal
  */
  function setVotingQuorum(uint256 _votingQuorum) public override onlyManager {
    require(_votingQuorum < 1e18);
    votingQuorum = _votingQuorum;
  }

  /**
    Set the proposal threshold for a gov proposal.
    @param _proposalThreshold the proposal threshold for a gov proposal
  */
  function setProposalThreshold(uint256 _proposalThreshold) public override onlyManager {
    require(_proposalThreshold < 1e18);
    proposalThreshold = _proposalThreshold;
  }

  /**
    Get the debt limit for a collateral type
    @dev this is a platform wide limit for new debt issuance against a specific collateral type
    @param _collateralType address of the collateral type
  */
  function collateralDebtLimit(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].debtLimit;
  }

  /**
    Get the liquidation ratio that needs to be maintained for a collateral type to avoid liquidation.
    @param _collateralType address of the collateral type
  */
  function collateralLiquidationRatio(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].liquidationRatio;
  }

  /**
    Get the minimum collateralization ratio for a collateral type for new borrowing or collateral withdrawal.
    @param _collateralType address of the collateral type
  */
  function collateralMinCollateralRatio(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio;
  }

  /**
    Get the borrowing rate for a collateral type
    @dev borrowing rate is specified for a 1 sec interval and accurancy is in RAY.
    @param _collateralType address of the collateral type
  */
  function collateralBorrowRate(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].borrowRate;
  }

  /**
    Get the origiation fee for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
  */
  function collateralOriginationFee(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].originationFee;
  }

  /**
    Get the liquidation bonus for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
  */
  function collateralLiquidationBonus(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].liquidationBonus;
  }

  /**
    Get the liquidation fee for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
  */
  function collateralLiquidationFee(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].liquidationFee;
  }

  /**
    Retreives the entire config for a specific config id.
    @param _id the ID of the conifg to be returned
  */
  function collateralConfigs(uint256 _id) public view override returns (CollateralConfig memory) {
    require(_id <= numCollateralConfigs, "Invalid config id");
    return _collateralConfigs[_id];
  }
}
