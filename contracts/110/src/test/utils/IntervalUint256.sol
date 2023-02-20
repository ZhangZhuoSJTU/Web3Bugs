// SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.0 <0.9.0;

struct IntervalUint256 {
    uint256 lo;
    uint256 hi;
}

library IntervalUint256Utils {
    function fromUint256(uint256 val)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(val, val);
    }

    function fromMeanAndTol(uint256 val, uint256 tol)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(val - tol, val + tol);
    }

    function fromMinAndTol(uint256 val, uint256 tol)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(val, val + tol);
    }

    function fromMaxAndTol(uint256 val, uint256 tol)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(val - tol, val);
    }

    function fromMeanAndTolBps(uint256 val, uint256 tolBps)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        uint256 tol = (val * tolBps) / 10_000;
        return IntervalUint256(val - tol, val + tol);
    }

    function fromMinAndTolBps(uint256 val, uint256 tolBps)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        uint256 tol = (val * tolBps) / 10_000;
        return IntervalUint256(val, val + tol);
    }

    function fromMaxAndTolBps(uint256 val, uint256 tolBps)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        uint256 tol = (val * tolBps) / 10_000;
        return IntervalUint256(val - tol, val);
    }

    function minmax(uint256 u1, uint256 u2)
        private
        pure
        returns (uint256, uint256)
    {
        return (u1 < u2) ? (u1, u2) : (u2, u1);
    }

    function mean(IntervalUint256 memory u) internal pure returns (uint256) {
        return (u.lo + u.hi) / 2;
    }

    function size(IntervalUint256 memory u) internal pure returns (uint256) {
        return u.hi - u.lo;
    }

    function add(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo + u2, u1.hi + u2);
    }

    function add(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo + u2.lo, u1.hi + u2.lo);
    }

    function sub(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo - u2, u1.hi - u2);
    }

    function subFrom(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u2 - u1.lo, u2 - u1.hi);
    }

    function sub(
        IntervalUint256 memory u1,
        IntervalUint256 memory u2,
        bool _dependent
    ) internal pure returns (IntervalUint256 memory) {
        return
            IntervalUint256(
                _dependent ? u1.lo - u2.lo : u1.lo - u2.hi,
                _dependent ? u1.hi - u2.hi : u1.hi - u2.lo
            );
    }

    function mul(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo * u2, u1.hi * u2);
    }

    function mul(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo * u2.lo, u1.hi * u2.hi);
    }

    function div(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (IntervalUint256 memory)
    {
        return IntervalUint256(u1.lo / u2, u1.hi / u2);
    }

    function div(
        IntervalUint256 memory u1,
        IntervalUint256 memory u2,
        bool _dependent
    ) internal pure returns (IntervalUint256 memory) {
        if (_dependent) {
            (uint256 lo, uint256 hi) = minmax(u1.lo / u2.lo, u1.hi / u2.hi);
            return IntervalUint256(lo, hi);
        } else {
            return IntervalUint256(u1.lo / u2.hi, u1.hi / u2.lo);
        }
    }

    function eq(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo == u2.lo && u1.hi == u2.hi;
    }

    function contains(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo <= u2 && u2 <= u1.hi;
    }

    function contains(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo <= u2.lo && u2.hi <= u1.hi;
    }

    function lt(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (bool)
    {
        return u1.hi < u2;
    }

    function lt(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.hi < u2.lo;
    }

    function le(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (bool)
    {
        return u1.hi <= u2;
    }

    function le(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.hi <= u2.lo;
    }

    function gt(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo > u2;
    }

    function gt(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo > u2.lo;
    }

    function ge(IntervalUint256 memory u1, uint256 u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo >= u2;
    }

    function ge(IntervalUint256 memory u1, IntervalUint256 memory u2)
        internal
        pure
        returns (bool)
    {
        return u1.lo >= u2.lo;
    }
}
