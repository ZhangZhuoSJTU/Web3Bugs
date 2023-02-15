pragma solidity 0.8.7;
/**
 * @title BondingPremium
 * @author @InsureDAO
 * @notice Insurance Premium Calclator
 * SPDX-License-Identifier: GPL-3.0
 */

import "../interfaces/IPremiumModel.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "../interfaces/IOwnership.sol";

contract BondingPremium is IPremiumModel {
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64 for int128;

    IOwnership public ownership;

    //variables
    uint256 public k; //final curve rate of the dynamic pricing
    uint256 public c; //initial base fee
    uint256 public b; //final base fee
    uint256 public T_1; //goal TVL (USDC)

    //constants
    uint256 public constant DECIMAL = uint256(1e6); //Decimals of USDC
    uint256 public constant BASE = uint256(1e6); //bonding curve graph takes 1e6 as 100.0000%
    uint256 public constant BASE_x2 = uint256(1e12); //BASE^2
    uint256 public constant ADJUSTER = uint256(10); //adjuster of 1e6 to 1e5 (100.0000% to 100.000%)

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Restricted: caller is not allowed to operate"
        );
        _;
    }

    constructor(address _ownership) {
        ownership = IOwnership(_ownership);

        //setPremium()
        k = 200100000;
        c = 10000;
        b = 1000;
        T_1 = 1000000 * DECIMAL;
    }

    /***
     * References
     * - Gitbook: https://app.gitbook.com/s/-Mb5ZmIrwF8VtxMhMijC/advanced/premium-pricing
     * - Desmos: https://www.desmos.com/calculator/7pmqdvaj5o
     */

    /***
     * @notice Get the current premium rate. 100% = 1e6
     * @param _totalLiquidity total liquidity token amount in the insurance pool.
     * @param _lockedAmount utilized token amount of the insurance pool.
     */
    function getCurrentPremiumRate(
        uint256 _totalLiquidity,
        uint256 _lockedAmount
    ) public view override returns (uint256) {
        require(
            _totalLiquidity >= _lockedAmount,
            "ERROR: _lockedAmount > _totalLiquidity"
        );
        // utilization rate (0~1000000)
        uint256 _util = (_lockedAmount * BASE) / _totalLiquidity;

        // yearly premium rate
        uint256 _premiumRate;

        uint256 T_0 = _totalLiquidity;
        if (T_0 > T_1) {
            T_0 = T_1;
        }

        uint256 a = (sqrt(
            (BASE_x2 * BASE_x2 * T_1 + 4 * k * T_0 * BASE_x2) / T_1
        ) - BASE_x2) / 2; //a*BASE (in calc)

        uint256 Q = (BASE - _util) + a / BASE; //x+a (in calc)

        _premiumRate =
            365 *
            (k * T_0 * BASE - a * Q * T_1) +
            Q *
            (c - b) *
            (T_1 - T_0) *
            BASE +
            b *
            Q *
            T_1 *
            BASE;

        _premiumRate = _premiumRate / Q / T_1 / BASE;

        //Return premium
        return _premiumRate;
    }

    /***
     * @notice Get premium rate.
     * @param _amount  token amount of insurance be bought
     * @param _totalLiquidity total liquidity token amount in the insurance pool.
     * @param _lockedAmount utilized token amount of the insurance pool.
     */
    struct Temp {
        int128 u;
        int128 a;
        int128 BASE_temp;
    }

    function getPremiumRate(
        uint256 _amount,
        uint256 _totalLiquidity,
        uint256 _lockedAmount
    ) public view override returns (uint256) {
        require(
            _amount + _lockedAmount <= _totalLiquidity,
            "exceed available balance"
        );

        if (_totalLiquidity == 0 || _amount == 0) {
            return 0;
        }

        uint256 u1 = BASE - ((_lockedAmount * BASE) / _totalLiquidity); //util rate before. 1000000 = 100.000%
        uint256 u2 = BASE -
            (((_lockedAmount + _amount) * BASE) / _totalLiquidity); //util rate after. 1000000 = 100.000%

        uint256 T_0 = _totalLiquidity;
        if (T_0 > T_1) {
            T_0 = T_1;
        }

        uint256 a = (sqrt(
            (BASE_x2 * BASE_x2 * T_1 + 4 * k * T_0 * BASE_x2) / T_1
        ) - BASE_x2) / 2; //a*BASE (in calc)

        Temp memory temp;
        temp.a = a.fromUInt();
        temp.BASE_temp = BASE.fromUInt();
        temp.a = temp.a.div(temp.BASE_temp);

        //calc 0=>u1 area
        temp.u = u1.fromUInt();
        int128 ln_u1 = (temp.u).add(temp.a).ln();
        uint256 ln_res_u1 = ln_u1.mulu(k); //k*ln(x+a) //very percise.

        uint256 _premium_u1 = (365 * T_0 * ln_res_u1 * BASE) +
            u1 *
            ((T_1 - T_0) * c * BASE + T_0 * b * BASE) -
            T_1 *
            365 *
            a *
            u1;

        //calc 0=>u2 area
        temp.u = u2.fromUInt();
        int128 ln_u2 = (temp.u).add(temp.a).ln();
        uint256 ln_res_u2 = ln_u2.mulu(k); //k*ln(x+a) //very percise.

        uint256 _premium_u2 = (365 * T_0 * ln_res_u2 * BASE) +
            u2 *
            ((T_1 - T_0) * c * BASE + T_0 * b * BASE) -
            T_1 *
            365 *
            a *
            u2;

        //(u1 area) - (u2 area) = premium rate between u1 and u2
        uint256 premiumRate = _premium_u1 - _premium_u2;
        premiumRate = premiumRate / T_1 / (u1 - u2) / BASE;

        return premiumRate;
    }

    /***
     * @notice Get premium. This returns token amount of premium buyer has to pay.
     * @param _amount
     * @param _term
     * @param _totalLiquidity total liquidity token amount in the insurance pool.
     * @param _lockedAmount utilized token amount of the insurance pool.
     */
    function getPremium(
        uint256 _amount,
        uint256 _term,
        uint256 _totalLiquidity,
        uint256 _lockedAmount
    ) external view override returns (uint256) {
        require(_amount + _lockedAmount <= _totalLiquidity, "Amount exceeds.");
        require(_totalLiquidity != 0, "_totalLiquidity cannnot be 0");

        if (_amount == 0) {
            return 0;
        }

        uint256 premiumRate = getPremiumRate(
            _amount,
            _totalLiquidity,
            _lockedAmount
        );

        uint256 premium = (_amount * premiumRate * _term) / 365 days / BASE;

        return premium;
    }

    /**
     * @notice Set a premium model
     * @param _multiplierPerYear The curve rate of premium per year.
     * @param _initialBaseRatePerYear The Initial Base rate addition to the bonding curve.
     * @param _finalBaseRatePerYear The Final Base rate addition to the bonding curve.
     * @param _goalTVL As TVL grows towards goalTVL, parameters gradually shift from initial to final value.
     */
    function setPremiumParameters(
        uint256 _multiplierPerYear,
        uint256 _initialBaseRatePerYear,
        uint256 _finalBaseRatePerYear,
        uint256 _goalTVL
    ) external override onlyOwner {
        require(
            _multiplierPerYear != 0 &&
                _initialBaseRatePerYear != 0 &&
                _finalBaseRatePerYear != 0 &&
                _goalTVL != 0,
            "ERROR_ZERO_VALUE_PROHIBITED"
        );
        k = _multiplierPerYear;
        c = _initialBaseRatePerYear;
        b = _finalBaseRatePerYear;
        T_1 = _goalTVL;
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
