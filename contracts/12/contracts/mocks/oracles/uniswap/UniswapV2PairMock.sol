// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract UniswapV2PairMock {
    uint112 public reserves0;
    uint112 public reserves1;
    uint32 public blockTimestamp;
    uint public price0CumulativeLast;
    uint public price1CumulativeLast;

    function setReserves(uint112 reserves0_, uint112 reserves1_, uint32 blockTimestamp_) external {
        reserves0 = reserves0_;
        reserves1 = reserves1_;
        blockTimestamp = blockTimestamp_;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserves0, reserves1, blockTimestamp);
    }

    function setCumulativePrices(uint cumPrice0, uint cumPrice1) external {
        price0CumulativeLast = cumPrice0;
        price1CumulativeLast = cumPrice1;
    }
}
