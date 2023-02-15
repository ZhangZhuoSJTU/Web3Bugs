// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface ILpToken is IERC20Upgradeable {
    function mint(address account, uint256 lpTokens) external;

    function burn(address account, uint256 burnAmount) external returns (uint256);

    function burn(uint256 burnAmount) external;

    function minter() external view returns (address);

    function initialize(
        string memory name_,
        string memory symbol_,
        uint8 _decimals,
        address _minter
    ) external returns (bool);
}
