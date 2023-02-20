// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "../Interfaces/ISafetyWithdraw.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SafetyWithdraw is Ownable, ISafetyWithdraw {
    function withdrawERC20Token(
        address tokenAddress,
        address to,
        uint256 amount
    ) external override onlyOwner {
        IERC20(tokenAddress).transfer(to, amount);
    }
}
