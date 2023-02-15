// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

interface IMinter {
    function mint(address) external;
}

// @dev - Must be funded by transferring crv to this contract post deployment, as opposed to minting directly
contract MockCurveMinter is IMinter {
    IERC20 public immutable crv;
    uint256 public rate;

    constructor(address _crv, uint256 _rate) {
        crv = IERC20(_crv);
        rate = _rate;
    }

    function mint(address) external {
        crv.transfer(msg.sender, rate);
    }
}
