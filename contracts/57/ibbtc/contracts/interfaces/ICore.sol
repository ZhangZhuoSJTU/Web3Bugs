// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ICore {
    function mint(uint btc, address account, bytes32[] calldata merkleProof) external returns (uint);
    function redeem(uint btc, address account) external returns (uint);
    function btcToBbtc(uint btc) external view returns (uint, uint);
    function bBtcToBtc(uint bBtc) external view returns (uint btc, uint fee);
    function pricePerShare() external view returns (uint);
}
