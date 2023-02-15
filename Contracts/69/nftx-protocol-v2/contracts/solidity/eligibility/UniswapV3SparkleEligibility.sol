// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "./NFTXEligibility.sol";
import "../util/OwnableUpgradeable.sol";

/// @title BitMath
/// @dev This library provides functionality for computing bit properties of an unsigned integer
library BitMath {
    /// @notice Returns the index of the most significant bit of the number,
    ///     where the least significant bit is at index 0 and the most significant bit is at index 255
    /// @dev The function satisfies the property:
    ///     x >= 2**mostSignificantBit(x) and x < 2**(mostSignificantBit(x)+1)
    /// @param x the value for which to compute the most significant bit, must be greater than 0
    /// @return r the index of the most significant bit
    function mostSignificantBit(uint256 x) internal pure returns (uint8 r) {
        require(x > 0);

        if (x >= 0x100000000000000000000000000000000) {
            x >>= 128;
            r += 128;
        }
        if (x >= 0x10000000000000000) {
            x >>= 64;
            r += 64;
        }
        if (x >= 0x100000000) {
            x >>= 32;
            r += 32;
        }
        if (x >= 0x10000) {
            x >>= 16;
            r += 16;
        }
        if (x >= 0x100) {
            x >>= 8;
            r += 8;
        }
        if (x >= 0x10) {
            x >>= 4;
            r += 4;
        }
        if (x >= 0x4) {
            x >>= 2;
            r += 2;
        }
        if (x >= 0x2) r += 1;
    }
}

interface INonfungiblePositionManager {
    /// @notice Returns the position information associated with a given token ID.
    /// @dev Throws if the token ID is not valid.
    /// @param tokenId The ID of the token that represents the position
    /// @return nonce The nonce for permits
    /// @return operator The address that is approved for spending
    /// @return token0 The address of the token0 for a specific pool
    /// @return token1 The address of the token1 for a specific pool
    /// @return fee The fee associated with the pool
    /// @return tickLower The lower end of the tick range for the position
    /// @return tickUpper The higher end of the tick range for the position
    /// @return liquidity The liquidity of the position
    /// @return feeGrowthInside0LastX128 The fee growth of token0 as of the last action on the individual position
    /// @return feeGrowthInside1LastX128 The fee growth of token1 as of the last action on the individual position
    /// @return tokensOwed0 The uncollected amount of token0 owed to the position as of the last computation
    /// @return tokensOwed1 The uncollected amount of token1 owed to the position as of the last computation
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    function factory() external view returns (address);
}

contract UniswapV3SparkleEligibility is NFTXEligibility, OwnableUpgradeable {
    address public constant positionManager = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    bytes32 internal constant POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;

    bool public isInitialized;
    mapping(address => bool) public validPools;

    /// @notice The identifying key of the pool
    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    function name() public pure override virtual returns (string memory) {    
        return "UniswapV3Sparkle";
    }

    function finalized() public view override virtual returns (bool) {
        return isInitialized && owner() == address(0);
    }

    function targetAsset() public pure override virtual returns (address) {
        return 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    }

    event NFTXEligibilityInit();
    event PoolsAdded(address[] poolsAdded);

    function __NFTXEligibility_init_bytes(bytes memory configData) public override virtual initializer {
        (address[] memory _validPools, address _owner) = abi.decode(configData, (address[], address));
        __NFTXEligibility_init(_validPools, _owner);
    }

    function __NFTXEligibility_init(address[] memory _validPools, address _owner) public initializer {
        __Ownable_init();
        isInitialized = true;
        addValidPools(_validPools);
        emit NFTXEligibilityInit();

        transferOwnership(_owner);
    }

    function addValidPools(address[] memory newPools) public onlyOwner {
        for (uint256 i = 0; i < newPools.length; i++) {
            validPools[newPools[i]] = true;
        }
        emit PoolsAdded(newPools);
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view override virtual returns (bool) {
        (, , address token0, address token1, uint24 fee, , , uint128 liquidity , , , uint128 tokensOwed0, uint128 tokensOwed1) 
            = INonfungiblePositionManager(positionManager).positions(_tokenId);
        bool cleared = liquidity == 0 && tokensOwed0 == 0 && tokensOwed1 == 0;
        if (!cleared) {
            return false;
        }
        address pool = computeAddress(
          INonfungiblePositionManager(positionManager).factory(),
          PoolKey({token0: token0, token1: token1, fee: fee})
        );
        if (!validPools[pool]) {
            return false;
        }
        return isRare(_tokenId, pool);
    }

    function isRare(uint256 tokenId, address poolAddress) internal pure returns (bool) {
      bytes32 h = keccak256(abi.encodePacked(tokenId, poolAddress));
      return uint256(h) < type(uint256).max / (1 + BitMath.mostSignificantBit(tokenId) * 2);
    }

    /// @notice Deterministically computes the pool address given the factory and PoolKey
    /// @param factory The Uniswap V3 factory contract address
    /// @param key The PoolKey
    /// @return pool The contract address of the V3 pool
    function computeAddress(address factory, PoolKey memory key) internal pure returns (address pool) {
        require(key.token0 < key.token1);
        pool = address(
            uint160(uint256(
                keccak256(
                    abi.encodePacked(
                        hex'ff',
                        factory,
                        keccak256(abi.encode(key.token0, key.token1, key.fee)),
                        POOL_INIT_CODE_HASH
                    )
                )
            ))
        );
    }
}
