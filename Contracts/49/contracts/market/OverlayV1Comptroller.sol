// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../libraries/FixedPoint.sol";

import "./OverlayV1Governance.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract OverlayV1Comptroller {

    using FixedPoint for uint256;

    uint256 private constant INVERSE_E = 0x51AF86713316A9A;
    uint256 private constant ONE = 1e18;

    // length of roller arrays when we circle
    uint256 constant CHORD = 60;

    // current element for new rolls
    uint256 public impactCycloid;
    uint256 public brrrrdCycloid;

    Roller[60] public impactRollers;
    Roller[60] public brrrrdRollers;

    struct Roller {
        uint time;
        uint ying;
        uint yang;
    }

    struct ImpactRoller {
        uint time;
        uint lPressure;
        uint sPressure;
    }

    struct BrrrrRoller {
        uint time;
        uint brrr;
        uint anti;
    }

    uint256 public immutable impactWindow;
    uint256 internal staticCap;
    uint256 public lmbda;

    uint256[2] public brrrrdAccumulator;
    uint256 public brrrrdWindowMicro;
    uint256 public brrrrdWindowMacro;
    uint256 public brrrrdExpected;
    uint256 public brrrrdFiling;

    constructor (
        uint256 _impactWindow
    ) {

        impactWindow = _impactWindow;

        impactRollers[0] = Roller({
            time: block.timestamp,
            ying: 0,
            yang: 0
        });

        brrrrdRollers[0] = Roller({
            time: block.timestamp,
            ying: 0,
            yang: 0
        });

    }

    function brrrr (
        uint _brrrr,
        uint _antiBrrrr
    ) internal {

        uint _now = block.timestamp;
        uint _brrrrdFiling = brrrrdFiling;

        if ( _now > _brrrrdFiling ) { // time to roll in the brrrrr

            uint _brrrrdCycloid = brrrrdCycloid;

            Roller memory _roller = brrrrdRollers[_brrrrdCycloid];

            uint _lastMoment = _roller.time;

            _roller.time = _brrrrdFiling;
            _roller.ying += brrrrdAccumulator[0];
            _roller.yang += brrrrdAccumulator[1];

            brrrrdCycloid = roll(brrrrdRollers, _roller, _lastMoment, _brrrrdCycloid);

            brrrrdAccumulator[0] = _brrrr;
            brrrrdAccumulator[1] = _antiBrrrr;

            uint _brrrrdWindowMicro = brrrrdWindowMicro;

            brrrrdFiling += _brrrrdWindowMicro
                + ( ( ( _now - _brrrrdFiling ) / _brrrrdWindowMicro ) * _brrrrdWindowMicro );

        } else { // add to the brrrr accumulator

            brrrrdAccumulator[0] += _brrrr;
            brrrrdAccumulator[1] += _antiBrrrr;

        }

    }

    function getBrrrrd () public view returns (
        uint brrrrd_,
        uint antiBrrrrd_
    ) {

        (  ,Roller memory _rollerNow,
            Roller memory _rollerThen ) = scry(
                brrrrdRollers,
                brrrrdCycloid,
                brrrrdWindowMacro
            );

        brrrrd_ = brrrrdAccumulator[0] + _rollerNow.ying - _rollerThen.ying;

        antiBrrrrd_ = brrrrdAccumulator[1] + _rollerNow.yang - _rollerThen.yang;

    }


    /// @notice Takes in the open interest and appllies Overlay's monetary policy
    /// @dev The impact is a measure of the demand placed on the market over a
    /// rolling window. It determines the amount of collateral to be burnt.
    /// This is akin to slippage in an order book model.
    /// @param _isLong Is it taking out open interest on the long or short side?
    /// @param _oi The amount of open interest attempting to be taken out
    /// @param _cap The current open interest cap
    /// @return impact_ A factor between zero and one to be applied to initial
    /// open interest to determine how much to take from the initial collateral
    /// before calculating the final collateral and open interest
    function intake (
        bool _isLong,
        uint _oi,
        uint _cap
    ) internal returns (
        uint impact_
    ) {

        (   Roller memory _rollerImpact,
            uint _lastMoment,
            uint _impact ) = _intake(_isLong, _oi, _cap);

        impactCycloid = roll(
            impactRollers,
            _rollerImpact,
            _lastMoment,
            impactCycloid
        );

        impact_ = _oi.mulUp(_impact);

        brrrr( 0, impact_ );

    }


    /// @notice Internal method to get historic impact data for impact factor
    /// @dev Historic data is represented as a sum of pressure accumulating
    /// over the impact window.
    /// @dev Pressure is the fraction of the open interest cap that any given
    /// build tries to take out on one side.  It can range from zero to infinity
    /// but will settle at a reasonable value otherwise any build will burn all
    /// of its initial collateral and receive a worthless position.
    /// @dev The sum of historic pressure is multiplied with lambda to yield
    /// the power by which we raise the inverse of Euler's number in order to
    /// determine the final impact.
    /// @param _isLong The side that open interest is being be taken out on.
    /// @param _oi The amount of open interest.
    /// @param _cap The open interest cap.
    /// @return rollerNow_ The current roller for the impact rollers. Impact
    /// from this particular call is accumulated on it for writing to storage.
    /// @return lastMoment_ The timestamp of the previously written roller
    /// which to determine whether to write to the current or the next.
    /// @return impact_ The factor by which to take from initial collateral.
    function _intake (
        bool _isLong,
        uint _oi,
        uint _cap
    ) internal view returns (
        Roller memory rollerNow_,
        uint lastMoment_,
        uint impact_
    ) {

        (   uint _lastMoment,
            Roller memory _rollerNow,
            Roller memory _rollerImpact ) = scry(
                impactRollers,
                impactCycloid,
                impactWindow );

        uint _pressure = _oi.divDown(_cap);

        if (_isLong) _rollerNow.ying += _pressure;
        else _rollerNow.yang += _pressure;

        uint _power = lmbda.mulDown(_isLong
            ? _rollerNow.ying - _rollerImpact.ying
            : _rollerNow.yang - _rollerImpact.yang
        );

        lastMoment_ = _lastMoment;
        rollerNow_ = _rollerNow;
        impact_ = _pressure != 0
            ? ONE.sub(INVERSE_E.powUp(_power))
            : 0;

    }


    /// @notice Internal function to compute cap.
    /// @dev Determines the cap relative to depth and dynamic or static
    /// @param _dynamic If printing has exceeded expectations and the
    /// cap is dynamic or static.
    /// @param _depth The depth of the market feed in OVL terms.
    /// @param _staticCap The static cap of the market.
    /// @param _brrrrd How much has been printed. Only passed if printing
    /// has occurred.
    /// @param _brrrrdExpected How much the market expects to print before
    /// engaging the dynamic cap. Only passed if printing has occurred.
    function _oiCap (
        bool _dynamic,
        uint _depth,
        uint _staticCap,
        uint _brrrrd,
        uint _brrrrdExpected
    ) internal pure returns (
        uint cap_
    ) {

        if (_dynamic) {

            uint _dynamicCap = ( 2e18 - _brrrrd.divDown(_brrrrdExpected) ).mulDown(_staticCap);
            cap_ = Math.min(_staticCap, Math.min(_dynamicCap, _depth));

        } else cap_ = Math.min(_staticCap, _depth);

    }


    /// @notice The open interest cap for the market
    /// @dev Returns the open interest cap for the market.
    /// @return cap_ The open interest cap.
    function oiCap () public virtual view returns (
        uint cap_
    ) {

        (   uint _brrrrd,
            uint _antiBrrrrd ) = getBrrrrd();

        uint _brrrrdExpected = brrrrdExpected;

        bool _burnt;
        bool _expected;
        bool _surpassed;

        if (_brrrrd < _antiBrrrrd) _burnt = true;
        else {
            _brrrrd -= _antiBrrrrd;
            _expected = _brrrrd < _brrrrdExpected;
            _surpassed = _brrrrd > _brrrrdExpected * 2;
        }

        cap_ = _surpassed ? 0 : _burnt || _expected
            ? _oiCap(false, depth(), staticCap, 0, 0)
            : _oiCap(true, depth(), staticCap, _brrrrd, brrrrdExpected);

    }


    /// @notice The time weighted liquidity of the market feed in OVL terms.
    /// @return depth_ The amount of liquidity in the market feed in OVL terms.
    function depth () public virtual view returns (uint depth_);

    /// @notice Performs arithmetic to turn market liquidity into OVL terms.
    /// @dev Derived from cnstant product formula X*Y=K and tailored 
    /// to Uniswap V3 selective liquidity provision.
    /// @param _marketLiquidity Amount of liquidity in market in ETH terms.
    /// @param _ovlPrice Price of OVL against ETH.
    /// @return depth_ Market depth in OVL terms.
    function computeDepth (
        uint _marketLiquidity,
        uint _ovlPrice
    ) public virtual view returns (uint depth_);


    function pressure (
        bool _isLong,
        uint _oi,
        uint _cap
    ) public view returns (uint pressure_) {
        (   ,
            Roller memory _rollerNow,
            Roller memory _rollerImpact ) = scry(
                impactRollers,
                impactCycloid,
                impactWindow );

        pressure_ = (_isLong
            ? _rollerNow.ying - _rollerImpact.ying
            : _rollerNow.yang - _rollerImpact.yang
        );

        pressure_ += _oi.divDown(_cap);

    }

    function impact (
        bool _isLong,
        uint _oi,
        uint _cap
    ) public view returns (uint impact_) {

        uint _pressure = pressure(_isLong, _oi, _cap);

        uint _power = lmbda.mulDown(_pressure);

        uint _impact = _pressure != 0
            ? ONE.sub(INVERSE_E.powUp(_power))
            : 0;

        impact_ = _oi.mulUp(_impact);

    }


    /// @notice The function that saves onto the respective roller array
    /// @dev This is multi purpose in that it can write to either the
    /// brrrrd rollers or the impact rollers. It knows when to increment the
    /// cycloid to point to the next roller index. It konws when it needs needs
    /// to write to the next roller or if it can safely write to the current one.
    /// If the current cycloid is the length of the array, then it sets to zero.
    /// @param rollers The set of rollers array from storage. It can operate on
    /// either the brrrrd rollers or the impact rollers.
    /// @param _roller The current roller to be written.
    /// @param _lastMoment The moment of the last write to determine to write to
    /// a new roller or the current one.
    /// @param _cycloid The current position of the circular buffer which
    /// always points to the most recent time.
    /// @return cycloid_ The next value of the cycloid.
    function roll (
        Roller[60] storage rollers,
        Roller memory _roller,
        uint _lastMoment,
        uint _cycloid
    ) internal returns (
        uint cycloid_
    ) {

        if (_roller.time != _lastMoment) {

            _cycloid += 1;

            if (_cycloid < CHORD) {

                rollers[_cycloid] = _roller;

            } else {

                _cycloid = 0;

                rollers[_cycloid] = _roller;

            }

        } else {

            rollers[_cycloid] = _roller;

        }

        cycloid_ = _cycloid;

    }


    /// @notice First part of retrieving historic roller values
    /// @dev Checks to see if the current roller is satisfactory and if not
    /// searches deeper into the roller array.
    /// @param rollers The roller array, either impact or brrrrd
    /// @param _cycloid The current impact or brrrrd cycloid
    /// @param _ago The target time
    /// @return lastMoment_ The time the most recent roller was written
    /// @return rollerNow_ The current roller with the time set to now
    /// @return rollerThen_ The roller closest and earlier to the target time
    function scry (
        Roller[60] storage rollers,
        uint _cycloid,
        uint _ago
    ) internal view returns (
        uint lastMoment_,
        Roller memory rollerNow_,
        Roller memory rollerThen_
    ) {

        uint _time = block.timestamp;

        rollerNow_ = rollers[_cycloid];

        lastMoment_ = rollerNow_.time;

        uint _target = _time - _ago;

        if (rollerNow_.time <= _target) {

            rollerNow_.time = _time;
            rollerThen_.ying = rollerNow_.ying;
            rollerThen_.yang = rollerNow_.yang;

            return ( lastMoment_, rollerNow_, rollerThen_ );

        } else if (_time != rollerNow_.time) {

            rollerNow_.time = _time;

        }

        (   Roller memory _beforeOrAt,
            Roller memory _atOrAfter ) = scryRollers(rollers, _cycloid, _target);

        rollerThen_ = _beforeOrAt;

    }


    function scryRollers (
        Roller[60] storage rollers,
        uint _cycloid,
        uint _target
    ) internal view returns (
        Roller memory beforeOrAt_,
        Roller memory atOrAfter_
    ) {

        beforeOrAt_ = rollers[_cycloid];

        // if the target is at or after the newest roller, we can return early
        if (beforeOrAt_.time <= _target) {

            if (beforeOrAt_.time == _target) {

                // if newest roller equals target, we're in the same block, so we can ignore atOrAfter
                return ( beforeOrAt_, atOrAfter_ );

            } else {

                atOrAfter_.time = block.timestamp;
                atOrAfter_.ying = beforeOrAt_.ying;
                atOrAfter_.yang = beforeOrAt_.yang;

                return ( beforeOrAt_, atOrAfter_ );

            }
        }

        // now, set before to the oldest roller
        _cycloid = ( _cycloid + 1 ) % CHORD;

        beforeOrAt_ = rollers[_cycloid];

        if ( beforeOrAt_.time <= 1 ) {

            beforeOrAt_ = rollers[0];

        }

        if (_target <= beforeOrAt_.time) return ( beforeOrAt_, beforeOrAt_ );
        else return binarySearch(
            rollers,
            uint32(_target),
            uint16(_cycloid)
        );

    }

    function binarySearch(
        Roller[60] storage self,
        uint32 _target,
        uint16 _cycloid
    ) private view returns (
        Roller memory beforeOrAt_,
        Roller memory atOrAfter_
    ) {

        uint256 l = (_cycloid + 1) % CHORD; // oldest print
        uint256 r = l + CHORD - 1; // newest print
        uint256 i;
        while (true) {
            i = (l + r) / 2;

            beforeOrAt_ = self[ i % CHORD ];

            // we've landed on an uninitialized roller, keep searching
            if (beforeOrAt_.time <= 1) { l = i + 1; continue; }

            atOrAfter_ = self[ (i + 1) % CHORD ];

            bool _targetAtOrAfter = beforeOrAt_.time <= _target;

            if (_targetAtOrAfter && _target <= atOrAfter_.time) break;

            if (!_targetAtOrAfter) r = i - 1;
            else l = i + 1;
        }
    }

}
