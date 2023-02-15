// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../Controller.sol";
import "../../interfaces/ILifeGuard.sol";
import "../../interfaces/IBuoy.sol";
import "../../interfaces/IWithdrawHandler.sol";
import "../../interfaces/IDepositHandler.sol";
import "./MockFlashLoanAttack.sol";

contract MockFlashLoan {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address private flNext;
    address private lifeguard;
    address private controller;

    constructor(address _flNext) public {
        flNext = _flNext;
    }

    function setController(address _controller) external {
        controller = _controller;
    }

    function setLifeGuard(address _lifeguard) external {
        lifeguard = _lifeguard;
    }

    function callNextChain(address gTokenAddress, uint256[3] calldata amounts) external {
        ILifeGuard lg = ILifeGuard(lifeguard);
        IBuoy buoy = IBuoy(lg.getBuoy());
        Controller c = Controller(controller);

        require(
            gTokenAddress == address(c.gvt()) || gTokenAddress == address(c.pwrd()),
            "invalid gTokenAddress"
        );

        address[3] memory tokens = c.stablecoins();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(c.depositHandler(), amounts[i]);
        }
        uint256 lp = buoy.stableToLp(amounts, true);
        uint256 lpWithSlippage = lp.sub(lp.div(1000));
        bool pwrd = gTokenAddress == address(c.pwrd());
        if (pwrd) {
            IDepositHandler(c.depositHandler()).depositPwrd(amounts, lpWithSlippage, address(0));
        } else {
            IDepositHandler(c.depositHandler()).depositGvt(amounts, lpWithSlippage, address(0));
        }

        IERC20(gTokenAddress).transfer(flNext, IERC20(gTokenAddress).balanceOf(address(this)));
        MockFlashLoanAttack(flNext).withdraw(pwrd, lpWithSlippage);
    }

    function withdrawDeposit(bool pwrd, uint256[3] calldata amounts) external {
        ILifeGuard lg = ILifeGuard(lifeguard);
        IBuoy buoy = IBuoy(lg.getBuoy());
        Controller c = Controller(controller);

        uint256 lp = buoy.stableToLp(amounts, false);
        uint256 lpWithSlippage = lp.add(lp.div(1000));
        uint256[3] memory minAmounts;
        IWithdrawHandler(c.withdrawHandler()).withdrawByLPToken(pwrd, lpWithSlippage, minAmounts);

        address[3] memory tokens = c.stablecoins();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(c.depositHandler(), amounts[i]);
        }
        lp = buoy.stableToLp(amounts, true);
        lpWithSlippage = lp.sub(lp.div(1000));
        if (pwrd) {
            IDepositHandler(c.depositHandler()).depositPwrd(amounts, lpWithSlippage, address(0));
        } else {
            IDepositHandler(c.depositHandler()).depositGvt(amounts, lpWithSlippage, address(0));
        }
    }

    function depositWithdraw(bool pwrd, uint256[3] calldata amounts) external {
        ILifeGuard lg = ILifeGuard(lifeguard);
        IBuoy buoy = IBuoy(lg.getBuoy());
        Controller c = Controller(controller);

        address[3] memory tokens = c.stablecoins();
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(c.depositHandler(), amounts[i]);
        }
        uint256 lp = buoy.stableToLp(amounts, true);
        uint256 lpWithSlippage = lp.sub(lp.div(1000));
        if (pwrd) {
            IDepositHandler(c.depositHandler()).depositPwrd(amounts, lpWithSlippage, address(0));
        } else {
            IDepositHandler(c.depositHandler()).depositGvt(amounts, lpWithSlippage, address(0));
        }

        lp = buoy.stableToLp(amounts, false);
        lpWithSlippage = lp.add(lp.div(1000));
        uint256[3] memory minAmounts;
        IWithdrawHandler(c.withdrawHandler()).withdrawByLPToken(pwrd, lpWithSlippage, minAmounts);
    }
}
