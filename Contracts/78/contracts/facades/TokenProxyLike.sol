// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
abstract contract TokenProxyLike is IERC20 {
    address internal baseToken;
    uint constant internal ONE = 1 ether;
    constructor (address _baseToken) {
        baseToken=_baseToken;
    }

    function mint(address to, uint256 amount) public virtual returns (uint);
    function redeem(address to, uint256 amount) public virtual returns (uint);
}