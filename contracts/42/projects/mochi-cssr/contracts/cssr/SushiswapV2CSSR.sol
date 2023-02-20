// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import {SushiswapV2Library} from "@mochifi/library/contracts/SushiswapV2Library.sol";
import {UQ112x112} from "@mochifi/library/contracts/UQ112x112.sol";
import {BlockVerifier} from "@mochifi/library/contracts/BlockVerifier.sol";
import {MerklePatriciaVerifier} from "@mochifi/library/contracts/MerklePatriciaVerifier.sol";
import {Rlp} from "@mochifi/library/contracts/Rlp.sol";
import {AccountVerifier} from "@mochifi/library/contracts/AccountVerifier.sol";
import {IUniswapV2Pair} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2CSSR.sol";

contract SushiswapV2CSSR is IUniswapV2CSSR {
    address public immutable override uniswapFactory;
    using UQ112x112 for uint224;

    bytes32 public constant reserveTimestampSlotHash =
        keccak256(abi.encodePacked(uint256(8)));
    bytes32 public constant token0Slot =
        keccak256(abi.encodePacked(uint256(9)));
    bytes32 public constant token1Slot =
        keccak256(abi.encodePacked(uint256(10)));

    uint256 public constant WINDOW_SIZE = 10 minutes;

    mapping(uint256 => Window) public window;
    // blockNumber => stateRoot
    mapping(uint256 => BlockData) public blockState;
    // blockNumber => pair => observedData
    mapping(uint256 => mapping(address => ObservedData)) public observedData;

    constructor(address _uniswapFactory) {
        uniswapFactory = _uniswapFactory;
    }

    // stores block data
    function saveState(bytes memory blockData)
        external
        override
        returns (
            bytes32 stateRoot,
            uint256 blockNumber,
            uint256 blockTimestamp
        )
    {
        (stateRoot, blockTimestamp, blockNumber) = BlockVerifier
            .extractStateRootAndTimestamp(blockData);
        if (blockState[blockNumber].blockTimestamp != 0) {
            return (stateRoot, blockNumber, blockTimestamp);
        }
        blockState[blockNumber] = BlockData({
            blockTimestamp: blockTimestamp,
            stateRoot: stateRoot
        });
        updateWindow(uint128(blockNumber), blockTimestamp);
    }

    function updateWindow(uint128 blockNumber, uint256 timestamp) internal {
        uint256 idx = windowIndex(timestamp);
        Window memory _window = window[idx];
        if (_window.from == 0 && _window.to == 0) {
            _window = Window({from: blockNumber, to: blockNumber});
        } else if (_window.from > blockNumber) {
            _window = Window({from: blockNumber, to: _window.to});
        } else if (_window.to < blockNumber) {
            _window = Window({from: _window.from, to: blockNumber});
        }
        window[idx] = _window;
    }

    function windowIndex(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / WINDOW_SIZE) * WINDOW_SIZE;
    }

    // does not cair about pair address since all it does is save the data
    function saveReserve(
        uint256 blockNumber,
        address pair,
        bytes memory accountProof,
        bytes memory reserveProof,
        bytes memory price0Proof,
        bytes memory price1Proof
    ) external override returns (ObservedData memory data) {
        bytes32 stateRoot = blockState[blockNumber].stateRoot;
        if (observedData[blockNumber][pair].reserveTimestamp != 0) {
            return observedData[blockNumber][pair];
        }
        bytes32 storageRoot = AccountVerifier.getAccountStorageRoot(
            pair,
            stateRoot,
            accountProof
        );
        (
            data.reserve0,
            data.reserve1,
            data.reserveTimestamp
        ) = unpackReserveData(
            Rlp.rlpBytesToUint256(
                MerklePatriciaVerifier.getValueFromProof(
                    storageRoot,
                    reserveTimestampSlotHash,
                    reserveProof
                )
            )
        );
        data.price0Data = Rlp.rlpBytesToUint256(
            MerklePatriciaVerifier.getValueFromProof(
                storageRoot,
                token0Slot,
                price0Proof
            )
        );
        data.price1Data = Rlp.rlpBytesToUint256(
            MerklePatriciaVerifier.getValueFromProof(
                storageRoot,
                token1Slot,
                price1Proof
            )
        );
        observedData[blockNumber][pair] = data;
    }

    function unpackReserveData(uint256 packedReserveData)
        internal
        pure
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 reserveTimestamp
        )
    {
        reserve0 = uint112(packedReserveData & (2**112 - 1));
        reserve1 = uint112((packedReserveData >> 112) & (2**112 - 1));
        reserveTimestamp = uint32(packedReserveData >> (112 + 112));
    }

    // locked **denominator** amount paired with token
    function getLiquidity(address token, address denominator)
        external
        view
        override
        returns (uint256)
    {
        IUniswapV2Pair pair = IUniswapV2Pair(
            SushiswapV2Library.pairFor(uniswapFactory, token, denominator)
        );
        Window memory currentWindow = window[windowIndex(block.timestamp)];
        uint128 lastObserved = currentWindow.to;
        if (lastObserved == 0) {
            lastObserved = window[windowIndex(block.timestamp) - WINDOW_SIZE]
                .to;
            require(lastObserved != 0, "!observed");
        }
        BlockData memory state = blockState[lastObserved];
        require(block.timestamp - state.blockTimestamp < WINDOW_SIZE, "stale");
        bool denominationTokenIs0;
        if (pair.token0() == denominator) {
            denominationTokenIs0 = true;
        } else if (pair.token1() == denominator) {
            denominationTokenIs0 = false;
        } else {
            revert("denominationToken invalid");
        }
        ObservedData memory historicData = observedData[lastObserved][
            address(pair)
        ];
        return
            denominationTokenIs0
                ? historicData.reserve0
                : historicData.reserve1;
    }

    function getExchangeRatio(address token, address denominator)
        external
        view
        override
        returns (uint256)
    {
        IUniswapV2Pair pair = IUniswapV2Pair(
            SushiswapV2Library.pairFor(uniswapFactory, token, denominator)
        );
        Window memory currentWindow = window[windowIndex(block.timestamp)];
        uint128 lastObserved = currentWindow.to;
        if (lastObserved == 0) {
            lastObserved = window[windowIndex(block.timestamp) - WINDOW_SIZE]
                .to;
            require(lastObserved != 0, "!observed");
        }
        BlockData memory state = blockState[lastObserved];
        require(block.timestamp - state.blockTimestamp < WINDOW_SIZE, "stale");
        bool denominationTokenIs0;
        if (pair.token0() == denominator) {
            denominationTokenIs0 = true;
        } else if (pair.token1() == denominator) {
            denominationTokenIs0 = false;
        } else {
            revert("denominationToken invalid");
        }
        //now calculate
        //get historic data
        ObservedData memory historicData = observedData[lastObserved][
            address(pair)
        ];
        uint256 historicePriceCumulative = calculatedPriceCumulative(
            denominationTokenIs0
                ? historicData.reserve0
                : historicData.reserve1,
            denominationTokenIs0
                ? historicData.reserve1
                : historicData.reserve0,
            denominationTokenIs0
                ? historicData.price1Data
                : historicData.price0Data,
            state.blockTimestamp - uint256(historicData.reserveTimestamp)
        );
        //get current data
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pair
            .getReserves();
        uint256 currentPriceCumulative = calculatedPriceCumulative(
            denominationTokenIs0 ? reserve0 : reserve1,
            denominationTokenIs0 ? reserve1 : reserve0,
            denominationTokenIs0
                ? pair.price1CumulativeLast()
                : pair.price0CumulativeLast(),
            block.timestamp - blockTimestampLast
        );
        return
            (currentPriceCumulative - historicePriceCumulative) /
            (block.timestamp - state.blockTimestamp);
    }

    function calculatedPriceCumulative(
        uint112 reserve,
        uint112 pairedReserve,
        uint256 priceCumulativeLast,
        uint256 timeElapsed
    ) internal pure returns (uint256) {
        if (timeElapsed == 0) {
            return priceCumulativeLast;
        }
        return
            priceCumulativeLast +
            timeElapsed *
            uint256(UQ112x112.encode(reserve).uqdiv(pairedReserve));
    }
}
