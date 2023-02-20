// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct Window {
    uint128 from;
    uint128 to;
}

struct BlockData {
    uint256 blockTimestamp;
    bytes32 stateRoot;
}

struct ObservedData {
    uint32 reserveTimestamp;
    uint112 reserve0;
    uint112 reserve1;
    uint256 price0Data;
    uint256 price1Data;
}

interface IUniswapV2CSSR {
    function uniswapFactory() external view returns (address);

    function getExchangeRatio(address token, address denominator)
        external
        view
        returns (uint256);

    function getLiquidity(address token, address denominator)
        external
        view
        returns (uint256);

    function saveState(bytes memory blockData)
        external
        returns (
            bytes32 stateRoot,
            uint256 blockNumber,
            uint256 blockTimestamp
        );

    function saveReserve(
        uint256 blockNumber,
        address pair,
        bytes memory accountProof,
        bytes memory reserveProof,
        bytes memory price0Proof,
        bytes memory price1Proof
    ) external returns (ObservedData memory data);
}
