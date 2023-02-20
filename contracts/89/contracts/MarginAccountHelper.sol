// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { VUSD } from "./VUSD.sol";
import { IMarginAccount } from "./Interfaces.sol";

contract MarginAccountHelper {
    using SafeERC20 for IERC20;

    uint constant VUSD_IDX = 0;

    IMarginAccount marginAccount;
    VUSD vusd;
    IERC20 public reserveToken;

    constructor(address _marginAccount, address _vusd) {
        marginAccount = IMarginAccount(_marginAccount);
        vusd = VUSD(_vusd);
        reserveToken = vusd.reserveToken();

        reserveToken.safeApprove(address(_vusd), type(uint).max);
        IERC20(_vusd).safeApprove(address(_marginAccount), type(uint).max);
    }

    function addVUSDMarginWithReserve(uint256 amount) external {
        reserveToken.safeTransferFrom(msg.sender, address(this), amount);
        vusd.mintWithReserve(address(this), amount);
        marginAccount.addMarginFor(VUSD_IDX, amount, msg.sender);
    }
}
