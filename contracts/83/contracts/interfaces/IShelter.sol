// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IShelter {

    event ShelterActivated(IERC20 indexed token);
    event ShelterDeactivated(IERC20 indexed token);
    event ExitShelter(IERC20 indexed token, address indexed refugee, address indexed destination, uint256 amount);

    function claimed(IERC20 _token, address _user) external view returns(bool);
    function activate(IERC20 _token) external;
    function deactivate(IERC20 _token) external;
    function withdraw(IERC20 _token, address _to) external;
}
