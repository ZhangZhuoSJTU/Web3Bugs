// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IShelterClient {
    function totalShare(IERC20 _token) external view returns(uint256);
    function shareOf(IERC20 _token, address _user) external view returns(uint256);
}
