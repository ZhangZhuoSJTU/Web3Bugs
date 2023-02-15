/*
    Copyright 2022 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

// Minimal Curve Stableswap Pool
contract CurveStableswapMock is ReentrancyGuard {

    address public constant ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using SafeMath for int128;
    using Address for address;

    address[] tokens;

    constructor(address[] memory _tokens) public {
        for (uint i = 0; i < _tokens.length; i++) {
            require(_tokens[i] != address(0));
        }
        tokens = _tokens;
    }

    function add_liquidity(uint256[] memory _amounts, uint256 _min_mint_amount) payable external nonReentrant returns (uint256) {
        for (uint i = 0; i < _amounts.length; i++) {
            if (tokens[i] == ETH_TOKEN_ADDRESS) {
                require(_amounts[i] == msg.value, "Eth sent should equal amount");
                continue;
            }
            IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);
        }
        return _min_mint_amount;
    }

    /**
     * @dev             Index values can be found via the `coins` public getter method
     * @param _i        Index value for the coin to send
     * @param _j        Index value of the coin to receive
     * @param _dx       Amount of `i` being exchanged
     * @param _min_dy   Minimum amount of `j` to receive
     * @return          Actual amount of `j` received
     */
    function exchange(int128 _i, int128 _j, uint256 _dx, uint256 _min_dy) payable external nonReentrant returns (uint256) {
        require(_i != _j);
        require(_dx == _min_dy);

        if (tokens[uint256(_i)] == ETH_TOKEN_ADDRESS) {
            require(_dx == msg.value);
        } else {
            IERC20(tokens[uint256(_i)]).transferFrom(msg.sender, address(this), _dx);
        }

        if (tokens[uint256(_j)] == ETH_TOKEN_ADDRESS) {
            Address.sendValue(payable(msg.sender), _min_dy);
        } else {
            IERC20(tokens[uint256(_j)]).transfer(msg.sender, _min_dy);
        }
        return _min_dy;
    }

    /**
     * @param _index            Index to look up address for.
     *
     * @return address          Address of the token at index
     */
    function coins(uint256 _index) external view returns (address) {
        return tokens[_index];
    }
}
