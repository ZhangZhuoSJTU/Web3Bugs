// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "../hyphen/LiquidityProviders.sol";
import "hardhat/console.sol";

contract LiquidityProvidersTest is LiquidityProviders {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    function addLpFeeTesting(address _token, uint256 _amount) external payable {
        totalReserve[_token] += _amount;
        totalLPFees[_token] += _amount;

        if (_token == NATIVE) {
            (bool success, ) = address(liquidityPool).call{value: msg.value}("");
            require(success, "ERR__NATIVE_TRANSFER_FAILED");
        } else {
            IERC20Upgradeable(_token).safeTransferFrom(msg.sender, address(liquidityPool), _amount);
        }
    }
}
