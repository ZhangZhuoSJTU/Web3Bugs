pragma solidity 0.5.12;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

interface IBPool {
    function getDenormalizedWeight(address token) external view returns(uint256);
    function getBalance(address token) external view returns(uint256);
    function getSwapFee() external view returns(uint256);
}

interface IBFactory {
    function isBPool(address b) external view returns (bool);
}


contract BRegistry {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct PoolPairInfo {
        uint80 weight1;
        uint80 weight2;
        uint80 swapFee;
        uint256 liq;
    }

    struct SortedPools {
        EnumerableSet.AddressSet pools;
        bytes32 indices;
    }

    event PoolTokenPairAdded(
        address indexed pool,
        address indexed token1,
        address indexed token2
    );

    event IndicesUpdated(
        address indexed token1,
        address indexed token2,
        bytes32 oldIndices,
        bytes32 newIndices
    );

    uint private constant BONE = 10**18;
    uint private constant MAX_SWAP_FEE = (3 * BONE) / 100;

    mapping(bytes32 => SortedPools) private _pools;
    mapping(address => mapping(bytes32 => PoolPairInfo)) private _infos;

    IBFactory bfactory;

    constructor(address _bfactory) public {
        bfactory = IBFactory(_bfactory);
    }

    function getPairInfo(address pool, address fromToken, address destToken)
        external view returns(uint256 weight1, uint256 weight2, uint256 swapFee)
    {
        bytes32 key = _createKey(fromToken, destToken);
        PoolPairInfo memory info = _infos[pool][key];
        return (info.weight1, info.weight2, info.swapFee);
    }

    function getPoolsWithLimit(address fromToken, address destToken, uint256 offset, uint256 limit)
        public view returns(address[] memory result)
    {
        bytes32 key = _createKey(fromToken, destToken);
        result = new address[](Math.min(limit, _pools[key].pools.values.length - offset));
        for (uint i = 0; i < result.length; i++) {
            result[i] = _pools[key].pools.values[offset + i];
        }
    }

    function getBestPools(address fromToken, address destToken)
        external view returns(address[] memory pools)
    {
        return getBestPoolsWithLimit(fromToken, destToken, 32);
    }

    function getBestPoolsWithLimit(address fromToken, address destToken, uint256 limit)
        public view returns(address[] memory pools)
    {
        bytes32 key = _createKey(fromToken, destToken);
        bytes32 indices = _pools[key].indices;
        uint256 len = 0;
        while (indices[len] > 0 && len < Math.min(limit, indices.length)) {
            len++;
        }

        pools = new address[](len);
        for (uint i = 0; i < len; i++) {
            uint256 index = uint256(uint8(indices[i])).sub(1);
            pools[i] = _pools[key].pools.values[index];
        }
    }

    // Add and update registry

    function addPoolPair(address pool, address token1, address token2) public returns(uint256 listed) {

        require(bfactory.isBPool(pool), "ERR_NOT_BPOOL");

        uint256 swapFee = IBPool(pool).getSwapFee();
        require(swapFee <= MAX_SWAP_FEE, "ERR_FEE_TOO_HIGH");

        bytes32 key = _createKey(token1, token2);
        _pools[key].pools.add(pool);

         if (token1 < token2) {
            _infos[pool][key] = PoolPairInfo({
                weight1: uint80(IBPool(pool).getDenormalizedWeight(token1)),
                weight2: uint80(IBPool(pool).getDenormalizedWeight(token2)),
                swapFee: uint80(swapFee),
                liq: uint256(0)
            });
        } else {
            _infos[pool][key] = PoolPairInfo({
                weight1: uint80(IBPool(pool).getDenormalizedWeight(token2)),
                weight2: uint80(IBPool(pool).getDenormalizedWeight(token1)),
                swapFee: uint80(swapFee),
                liq: uint256(0)
            });
        }

        emit PoolTokenPairAdded(
            pool,
            token1,
            token2
        );

        listed++;

    }

    function addPools(address[] calldata pools, address token1, address token2) external returns(uint256[] memory listed) {
        listed = new uint256[](pools.length);
        for (uint i = 0; i < pools.length; i++) {
            listed[i] = addPoolPair(pools[i], token1, token2);
        }
    }

    function sortPools(address[] calldata tokens, uint256 lengthLimit) external {
        for (uint i = 0; i < tokens.length; i++) {
            for (uint j = i + 1; j < tokens.length; j++) {
                bytes32 key = _createKey(tokens[i], tokens[j]);
                address[] memory pools = getPoolsWithLimit(tokens[i], tokens[j], 0, Math.min(256, lengthLimit));
                uint256[] memory effectiveLiquidity = _getEffectiveLiquidityForPools(tokens[i], tokens[j], pools);

                bytes32 indices = _buildSortIndices(effectiveLiquidity);

                // console.logBytes32(indices);

                if (indices != _pools[key].indices) {
                    emit IndicesUpdated(
                        tokens[i] < tokens[j] ? tokens[i] : tokens[j],
                        tokens[i] < tokens[j] ? tokens[j] : tokens[i],
                        _pools[key].indices,
                        indices
                    );
                    _pools[key].indices = indices;
                }
            }
        }
    }

    function sortPoolsWithPurge(address[] calldata tokens, uint256 lengthLimit) external {
        for (uint i = 0; i < tokens.length; i++) {
            for (uint j = i + 1; j < tokens.length; j++) {
                bytes32 key = _createKey(tokens[i], tokens[j]);
                address[] memory pools = getPoolsWithLimit(tokens[i], tokens[j], 0, Math.min(256, lengthLimit));
                uint256[] memory effectiveLiquidity = _getEffectiveLiquidityForPoolsPurge(tokens[i], tokens[j], pools);
                bytes32 indices = _buildSortIndices(effectiveLiquidity);

                if (indices != _pools[key].indices) {
                    emit IndicesUpdated(
                        tokens[i] < tokens[j] ? tokens[i] : tokens[j],
                        tokens[i] < tokens[j] ? tokens[j] : tokens[i],
                        _pools[key].indices,
                        indices
                    );
                    _pools[key].indices = indices;
                }
            }
        }
    }

    // Internal

    function _createKey(address token1, address token2)
        internal pure returns(bytes32)
    {
        return bytes32(
            (uint256(uint128((token1 < token2) ? token1 : token2)) << 128) |
            (uint256(uint128((token1 < token2) ? token2 : token1)))
        );
    }

    function _getEffectiveLiquidityForPools(address token1, address token2, address[] memory pools)
        internal view returns(uint256[] memory effectiveLiquidity)
    {
        effectiveLiquidity = new uint256[](pools.length);
        for (uint i = 0; i < pools.length; i++) {
            bytes32 key = _createKey(token1, token2);
            PoolPairInfo memory info = _infos[pools[i]][key];
            if (token1 < token2) {
                // we define effective liquidity as b2 * w1 / (w1 + w2)
                effectiveLiquidity[i] = bdiv(uint256(info.weight1),uint256(info.weight1).add(uint256(info.weight2)));
                effectiveLiquidity[i] = effectiveLiquidity[i].mul(IBPool(pools[i]).getBalance(token2));
                // console.log("1. %s: %s", pools[i], effectiveLiquidity[i]);
            } else {
                effectiveLiquidity[i] = bdiv(uint256(info.weight2),uint256(info.weight1).add(uint256(info.weight2)));
                effectiveLiquidity[i] = effectiveLiquidity[i].mul(IBPool(pools[i]).getBalance(token2));
                // console.log("2. %s: %s", pools[i], effectiveLiquidity[i]);
            }
        }
    }

    // Calculates total liquidity for all existing token pair pools
    // Removes any that are below threshold
    function _getEffectiveLiquidityForPoolsPurge(address token1, address token2, address[] memory pools)
        public returns(uint256[] memory effectiveLiquidity)
    {
        uint256 totalLiq = 0;
        bytes32 key = _createKey(token1, token2);

        // Store each pools liquidity and sum total liquidity
        for (uint i = 0; i < pools.length; i++) {
            PoolPairInfo memory info = _infos[pools[i]][key];
            if (token1 < token2) {
                // we define effective liquidity as b2 * w1 / (w1 + w2)
                _infos[pools[i]][key].liq = bdiv(uint256(info.weight1), uint256(info.weight1).add(uint256(info.weight2)));
                _infos[pools[i]][key].liq = _infos[pools[i]][key].liq.mul(IBPool(pools[i]).getBalance(token2));
                totalLiq = totalLiq.add(_infos[pools[i]][key].liq);
                // console.log("1. %s: %s", pools[i], _infos[pools[i]][key].liq);
            } else {
                _infos[pools[i]][key].liq = bdiv(uint256(info.weight2), uint256(info.weight1).add(uint256(info.weight2)));
                _infos[pools[i]][key].liq = _infos[pools[i]][key].liq.mul(IBPool(pools[i]).getBalance(token2));
                totalLiq = totalLiq.add(_infos[pools[i]][key].liq);
                // console.log("2. %s: %s", pools[i], _infos[pools[i]][key].liq);
            }
        }

        uint256 threshold = bmul(totalLiq, ((10 * BONE) / 100));
        // console.log("totalLiq: %s, Thresh: %s", totalLiq, threshold);

        // Delete any pools that aren't greater than threshold (10% of total)
        for(uint i = 0;i < _pools[key].pools.length();i++){
            //console.log("Pool: %s, %s", _pools[key].pools.values[i], info.liq);
            if(_infos[_pools[key].pools.values[i]][key].liq < threshold){
                _pools[key].pools.remove(_pools[key].pools.values[i]);
            }
        }

        effectiveLiquidity = new uint256[](_pools[key].pools.length());

        // pool.remove reorders pools so need to use correct liq for index
        for(uint i = 0;i < _pools[key].pools.length();i++){
            // console.log(_pools[key].pools.values[i]);
            effectiveLiquidity[i] = _infos[_pools[key].pools.values[i]][key].liq;
        }
    }

    function bdiv(uint a, uint b)
        internal pure
        returns (uint)
    {
        require(b != 0, "ERR_DIV_ZERO");
        uint c0 = a * BONE;
        require(a == 0 || c0 / a == BONE, "ERR_DIV_INTERNAL"); // bdiv overflow
        uint c1 = c0 + (b / 2);
        require(c1 >= c0, "ERR_DIV_INTERNAL"); //  badd require
        uint c2 = c1 / b;
        return c2;
    }

    function bmul(uint a, uint b)
        internal pure
        returns (uint)
    {
        uint c0 = a * b;
        require(a == 0 || c0 / a == b, "ERR_MUL_OVERFLOW");
        uint c1 = c0 + (BONE / 2);
        require(c1 >= c0, "ERR_MUL_OVERFLOW");
        uint c2 = c1 / BONE;
        return c2;
    }

    function _buildSortIndices(uint256[] memory effectiveLiquidity)
        internal pure returns(bytes32)
    {
        uint256 result = 0;
        uint256 prevEffectiveLiquidity = uint256(-1);
        for (uint i = 0; i < Math.min(effectiveLiquidity.length, 32); i++) {
            uint256 bestIndex = 0;
            for (uint j = 0; j < effectiveLiquidity.length; j++) {
                if ((effectiveLiquidity[j] > effectiveLiquidity[bestIndex] && effectiveLiquidity[j] < prevEffectiveLiquidity) || effectiveLiquidity[bestIndex] >= prevEffectiveLiquidity) {
                    bestIndex = j;
                }
            }
            prevEffectiveLiquidity = effectiveLiquidity[bestIndex];
            result |= (bestIndex + 1) << (248 - i * 8);
        }
        return bytes32(result);
    }
}