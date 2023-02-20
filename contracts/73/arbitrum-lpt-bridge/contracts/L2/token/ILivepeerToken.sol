//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILivepeerToken is IERC20 {
    event Mint(address indexed to, uint256 amount);

    event Burn(address indexed burner, uint256 amount);

    function mint(address _to, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;
}
