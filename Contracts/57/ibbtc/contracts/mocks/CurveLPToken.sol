// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CurveLPToken is ERC20 {

    constructor() ERC20("Curve LP", "crvLP") public {}

    function mint(address account, uint amount) public {
        _mint(account, amount);
    }
}
