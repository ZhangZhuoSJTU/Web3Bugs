// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

abstract contract UniPairLike {
    function factory() public view virtual returns (address);

    function getReserves()
        public
        view
        virtual
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        );

    function mint(address to) external virtual returns (uint256 liquidity);

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external virtual;

    function totalSupply() external virtual returns (uint256);
}
