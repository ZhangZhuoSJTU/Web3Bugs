// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

import "./LibERC20Storage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library LibERC20 {
    using SafeMath for uint256;

    // Need to include events locally because `emit Interface.Event(params)` does not work
    event Transfer(address indexed from, address indexed to, uint256 amount);

    function mint(address _to, uint256 _amount) internal {
        require(_to != address(0), "INVALID_TO_ADDRESS");

        LibERC20Storage.ERC20Storage storage es =
            LibERC20Storage.erc20Storage();

        es.balances[_to] = es.balances[_to].add(_amount);
        es.totalSupply = es.totalSupply.add(_amount);
        emit Transfer(address(0), _to, _amount);
    }

    function burn(address _from, uint256 _amount) internal {
        LibERC20Storage.ERC20Storage storage es =
            LibERC20Storage.erc20Storage();

        es.balances[_from] = es.balances[_from].sub(_amount);
        es.totalSupply = es.totalSupply.sub(_amount);
        emit Transfer(_from, address(0), _amount);
    }
}
