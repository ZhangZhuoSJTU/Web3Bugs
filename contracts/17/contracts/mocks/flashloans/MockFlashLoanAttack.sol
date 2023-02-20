// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/ILifeGuard.sol";
import "../../interfaces/IBuoy.sol";
import "../../interfaces/IWithdrawHandler.sol";

contract MockFlashLoanAttack {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address private lifeguard;
    address private controller;

    function setController(address _controller) external {
        controller = _controller;
    }

    function setLifeGuard(address _lifeguard) external {
        lifeguard = _lifeguard;
    }

    function withdraw(bool pwrd, uint256 lpAmount) public {
        IController c = IController(controller);

        uint256[3] memory minAmounts;
        IWithdrawHandler(c.withdrawHandler()).withdrawByLPToken(pwrd, lpAmount, minAmounts);
    }
}
