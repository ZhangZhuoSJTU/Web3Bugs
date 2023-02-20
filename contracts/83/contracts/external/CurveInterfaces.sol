// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICurveMetaPool is IERC20{
    function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount) external;
    function remove_liquidity(uint256 _burning_amount, uint256[2] calldata _min_amounts) external;
}
