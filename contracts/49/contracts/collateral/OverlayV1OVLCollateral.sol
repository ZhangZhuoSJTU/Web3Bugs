
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../libraries/Position.sol";
import "../libraries/FixedPoint.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "../interfaces/IOverlayV1Market.sol";
import "../interfaces/IOverlayV1Mothership.sol";
import "../interfaces/IOverlayToken.sol";
import "../interfaces/IOverlayTokenNew.sol";

contract OverlayV1OVLCollateral is ERC1155Supply {

    event log(string k, uint v);
    event log_addr(string k, address v);

    using Position for Position.Info;
    using FixedPoint for uint256;

    bytes32 constant private GOVERNOR = keccak256("GOVERNOR");

    mapping (address => mapping(uint => uint)) internal currentBlockPositionsLong;
    mapping (address => mapping(uint => uint)) internal currentBlockPositionsShort;
    mapping (address => MarketInfo) public marketInfo;
    struct MarketInfo {
        uint marginMaintenance;
        uint marginRewardRate;
        uint maxLeverage;
    }

    Position.Info[] public positions;

    IOverlayV1Mothership public immutable mothership;
    IOverlayTokenNew immutable public ovl;

    uint256 public fees;
    uint256 public liquidations;

    event Build(
        address market,
        uint256 positionId,
        uint256 oi,
        uint256 debt
    );

    event Unwind(
        address market,
        uint256 positionId,
        uint256 oi,
        uint256 debt
    );

    event Liquidate(
        uint256 positionId,
        uint256 oi,
        uint256 reward,
        address rewarded
    );

    event Update(
        uint feesCollected,
        uint feesBurned,
        uint liquidationsCollected,
        uint liquidationsBurned
    );

    modifier onlyGovernor () {
        require(mothership.hasRole(GOVERNOR, msg.sender), "OVLV1:!governor");
        _;
    }

    constructor (
        string memory _uri,
        address _mothership
    ) ERC1155(_uri) {

        mothership = IOverlayV1Mothership(_mothership);

        ovl = IOverlayV1Mothership(_mothership).ovl();

        positions.push(Position.Info({
            market: address(0),
            isLong: false,
            leverage: 0,
            pricePoint: 0,
            oiShares: 0,
            debt: 0,
            cost: 0
        }));

    }

    function setMarketInfo (
        address _market,
        uint _marginMaintenance,
        uint _marginRewardRate,
        uint _maxLeverage
    ) external onlyGovernor {

        marketInfo[_market].marginMaintenance = _marginMaintenance;
        marketInfo[_market].marginRewardRate = _marginRewardRate;
        marketInfo[_market].maxLeverage = _maxLeverage;

    }

    function marginMaintenance(
        address _market
    ) external view returns (
        uint marginMaintenance_
    ) {

        marginMaintenance_ = marketInfo[_market].marginMaintenance;

    }

    function maxLeverage(
        address _market
    ) external view returns (
        uint maxLeverage_
    ) {

        maxLeverage_ = marketInfo[_market].maxLeverage;

    }

    function marginRewardRate(
        address _market
    ) external view returns (
        uint marginRewardRate_
    ) {

        marginRewardRate_ = marketInfo[_market].marginRewardRate;

    }


    /// @notice Disburses fees
    function disburse () public {

        (   uint256 _marginBurnRate,
            uint256 _feeBurnRate,
            address _feeTo ) = mothership.getUpdateParams();

        uint _feeForward = fees;
        uint _feeBurn = _feeForward.mulUp(_feeBurnRate);
        _feeForward = _feeForward - _feeBurn;

        uint _liqForward = liquidations;
        uint _liqBurn = _liqForward.mulUp(_marginBurnRate);
        _liqForward -= _liqBurn;

        fees = 0;
        liquidations = 0;

        emit Update(
            _feeForward,
            _feeBurn,
            _liqForward,
            _liqBurn
        );

        ovl.burn(address(this), _feeBurn + _liqBurn);
        ovl.transfer(_feeTo, _feeForward + _liqForward);

    }

    function getCurrentBlockPositionId (
        address _market,
        bool _isLong,
        uint _leverage,
        uint _pricePointNext
    ) internal returns (
        uint positionId_
    ) {

        mapping(uint=>uint) storage _currentBlockPositions = _isLong
            ? currentBlockPositionsLong[_market]
            : currentBlockPositionsShort[_market];

        positionId_ = _currentBlockPositions[_leverage];

        Position.Info storage position = positions[positionId_];

        if (position.pricePoint < _pricePointNext) {

            positions.push(Position.Info({
                market: _market,
                isLong: _isLong,
                leverage: _leverage,
                pricePoint: _pricePointNext,
                oiShares: 0,
                debt: 0,
                cost: 0
            }));

            positionId_ = positions.length - 1;

            _currentBlockPositions[_leverage] = positionId_;

        }

    }


    /// @notice Build a position on Overlay with OVL collateral
    /// @dev This interacts with an Overlay Market to register oi and hold 
    /// positions on behalf of users.
    /// @param _market The address of the desired market to interact with.
    /// @param _collateral The amount of OVL to use as collateral in the position.
    /// @param _leverage The amount of leverage to use in the position
    /// @param _isLong Whether to take out a position on the long or short side.
    /// @param _oiMinimum Minimum acceptable amount of OI after impact and fees.
    /// @return positionId_ Id of the built position for on chain convenience.
    function build (
        address _market,
        uint256 _collateral,
        uint256 _leverage,
        bool _isLong,
        uint256 _oiMinimum
    ) external returns (
        uint positionId_
    ) {

        require(mothership.marketActive(_market), "OVLV1:!market");
        require(_leverage <= marketInfo[_market].maxLeverage, "OVLV1:lev>max");

        (   uint _oiAdjusted,
            uint _collateralAdjusted,
            uint _debtAdjusted,
            uint _fee,
            uint _impact,
            uint _pricePointNext ) = IOverlayV1Market(_market)
                .enterOI(
                    _isLong,
                    _collateral,
                    _leverage
                );

        require(_oiAdjusted >= _oiMinimum, "OVLV1:oi<min");

        uint _positionId = getCurrentBlockPositionId(
            _market,
            _isLong,
            _leverage,
            _pricePointNext
        );

        Position.Info storage pos = positions[_positionId];

        pos.oiShares += _oiAdjusted;
        pos.cost += _collateralAdjusted;
        pos.debt += _debtAdjusted;

        fees += _fee;

        emit Build(_market, _positionId, _oiAdjusted, _debtAdjusted);

        ovl.transferFromBurn(msg.sender, address(this), _collateralAdjusted + _fee, _impact);

        // ovl.burn(msg.sender, _impact);

        _mint(msg.sender, _positionId, _oiAdjusted, ""); // WARNING: last b/c erc1155 callback

        positionId_ = _positionId;

    }

    /// @notice Unwinds shares of an existing position.
    /// @dev Interacts with a market contract to realize the PnL on a position.
    /// @param _positionId Id of the position to be unwound.
    /// @param _shares Number of shars to unwind from the position.
    function unwind (
        uint256 _positionId,
        uint256 _shares
    ) external {

        require( 0 < _shares && _shares <= balanceOf(msg.sender, _positionId), "OVLV1:!shares");

        Position.Info storage pos = positions[_positionId];

        require(0 < pos.oiShares, "OVLV1:liquidated");

        {

        (   uint _oi,
            uint _oiShares,
            uint _priceFrame ) = IOverlayV1Market(pos.market)
                .exitData(
                    pos.isLong,
                    pos.pricePoint
                );

        uint _totalPosShares = totalSupply(_positionId);

        uint _userOiShares = _shares;
        uint _userNotional = _shares * pos.notional(_oi, _oiShares, _priceFrame) / _totalPosShares;
        uint _userDebt = _shares * pos.debt / _totalPosShares;
        uint _userCost = _shares * pos.cost / _totalPosShares;
        uint _userOi = _shares * pos.oi(_oi, _oiShares) / _totalPosShares;

        emit Unwind(pos.market, _positionId, _userOi, _userDebt);

        // TODO: think through edge case of underwater position ... and fee adjustments ...
        uint _feeAmount = _userNotional.mulUp(mothership.fee());

        uint _userValueAdjusted = _userNotional - _feeAmount;
        if (_userValueAdjusted > _userDebt) _userValueAdjusted -= _userDebt;
        else _userValueAdjusted = 0;

        fees += _feeAmount; // adds to fee pot, which is transferred on update

        pos.debt -= _userDebt;
        pos.cost -= _userCost;
        pos.oiShares -= _userOiShares;

        // ovl.transfer(msg.sender, _userCost);

        // mint/burn excess PnL = valueAdjusted - cost
        if (_userCost < _userValueAdjusted) {

            ovl.transferMint(
                msg.sender, 
                _userCost, 
                _userValueAdjusted - _userCost
            );

        } else {

            ovl.transferBurn(
                msg.sender, 
                _userValueAdjusted, 
                _userCost - _userValueAdjusted
            );

        }


        IOverlayV1Market(pos.market).exitOI(
            pos.isLong,
            _userOi,
            _userOiShares,
            _userCost < _userValueAdjusted ? _userValueAdjusted - _userCost : 0,
            _userCost < _userValueAdjusted ? 0 : _userCost - _userValueAdjusted
        );

        }

        _burn(msg.sender, _positionId, _shares);

    }

    /// @notice Liquidates an existing position.
    /// @dev Interacts with an Overlay Market to exit all open interest
    /// associated with a liquidatable positoin.
    /// @param _positionId ID of the position being liquidated.
    /// @param _rewardsTo Address to send liquidation reward to.
    function liquidate (
        uint256 _positionId,
        address _rewardsTo
    ) external {

        Position.Info storage pos = positions[_positionId];

        require(0 < pos.oiShares, "OVLV1:liquidated");

        bool _isLong = pos.isLong;

        (   uint _oi,
            uint _oiShares,
            uint _priceFrame ) = IOverlayV1Market(pos.market)
                .exitData(
                    _isLong,
                    pos.pricePoint
                );

        MarketInfo memory _marketInfo = marketInfo[pos.market];

        require(pos.isLiquidatable(
            _oi,
            _oiShares,
            _priceFrame,
            _marketInfo.marginMaintenance
        ), "OVLV1:!liquidatable");

        uint _value = pos.value(_oi, _oiShares, _priceFrame);

        IOverlayV1Market(pos.market).exitOI(
            _isLong,
            pos.oi(_oi, _oiShares),
            pos.oiShares,
            0,
            pos.cost - _value
        );

        // TODO: which is better on gas
        pos.oiShares = 0;
        pos.debt = 0;
        // positions[positionId].oiShares = 0;

        uint _toReward = _value.mulUp(_marketInfo.marginRewardRate);

        liquidations += _value - _toReward;

        emit Liquidate(
            _positionId,
            _oi,
            _toReward,
            _rewardsTo
        );

        // ovl.burn(address(this), pos.cost - _value);
        ovl.transferBurn(_rewardsTo, _toReward, pos.cost - _value);

    }


    /// @notice Retrieves required information from market contract 
    /// to calculate position value with.
    /// @dev Gets price frame, total open interest and 
    /// total open interest shares from an Overlay market.
    /// @param _positionId ID of position to determine value of.
    /// @return value_ Value of the position
    function value (
        uint _positionId
    ) public view returns (
        uint256 value_
    ) {

        Position.Info storage pos = positions[_positionId];

        IOverlayV1Market _market = IOverlayV1Market(pos.market);

        (   uint _oi,
            uint _oiShares,
            uint _priceFrame ) = _market
            .positionInfo(
                pos.isLong,
                pos.pricePoint
            );

        value_ = pos.value(
            _oi,
            _oiShares,
            _priceFrame
        );

    }

}
