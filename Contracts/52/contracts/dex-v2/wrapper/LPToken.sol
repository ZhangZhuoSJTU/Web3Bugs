// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/dex-v2/pool/IVaderPoolV2.sol";
import "../../interfaces/dex-v2/wrapper/ILPToken.sol";

contract LPToken is ILPToken, ProtocolConstants, ERC20, Ownable {
    IERC20Extended public immutable foreignAsset;
    IVaderPoolV2 public immutable pool;

    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20Extended _foreignAsset, IVaderPoolV2 _pool)
        ERC20(_calculateName(_foreignAsset), _calculateSymbol(_foreignAsset))
    {
        foreignAsset = _foreignAsset;
        pool = _pool;
        transferOwnership(address(_pool));
    }

    /* ========== VIEWS ========== */

    function totalSupply() public view override returns (uint256) {
        return pool.pairSupply(foreignAsset);
    }

    function balanceOf(address user) public view override returns (uint256) {
        if (user == address(pool)) return totalSupply() - ERC20.totalSupply();
        else return ERC20.balanceOf(user);
    }

    function _calculateName(IERC20Extended token)
        internal
        view
        returns (string memory)
    {
        return _combine(token.name(), " - USDV LP");
    }

    function _calculateSymbol(IERC20Extended token)
        internal
        view
        returns (string memory)
    {
        return _combine("V(", token.symbol(), "|USDV)");
    }

    function _combine(string memory a, string memory b)
        internal
        pure
        returns (string memory)
    {
        return _combine(a, b, "");
    }

    function _combine(
        string memory a,
        string memory b,
        string memory c
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b, c));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }
}
