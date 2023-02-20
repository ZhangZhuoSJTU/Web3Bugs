// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ERC677/ERC20Burnable.sol";

contract MockMigrationUniPair is ERC20Burnable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function factory() public view returns (address) {
        return address(this);
    }

    uint112 reserve0;
    uint112 reserve1;

    function setReserves(uint112 r0, uint112 r1) public {
        reserve0 = r0;
        reserve1 = r1;
    }

    function getReserves()
        public
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        return (reserve0, reserve1, uint32(block.timestamp));
    }

    function mint(address to) external returns (uint256 liquidity) {
        uint256 val = (reserve0 * reserve1) / (reserve0 + reserve1);
        _mint(to, val);
        return val;
    }

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external {}
}
