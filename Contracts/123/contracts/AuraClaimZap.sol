// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { AuraMath } from "./AuraMath.sol";
import { IAuraLocker, ICrvDepositorWrapper } from "./Interfaces.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

interface IBasicRewards {
    function getReward(address _account, bool _claimExtras) external;

    function getReward(address _account) external;

    function getReward(address _account, address _token) external;

    function stakeFor(address, uint256) external;
}

/**
 * @title   ClaimZap
 * @author  ConvexFinance -> AuraFinance
 * @notice  Claim zap to bundle various reward claims
 * @dev     Claims from all pools, and stakes cvxCrv and CVX if wanted.
 *          v2:
 *           - change exchange to use curve pool
 *           - add getReward(address,token) type
 *           - add option to lock cvx
 *           - add option use all funds in wallet
 */
contract AuraClaimZap {
    using SafeERC20 for IERC20;
    using AuraMath for uint256;

    address public immutable crv;
    address public immutable cvx;
    address public immutable cvxCrv;
    address public immutable crvDepositWrapper;
    address public immutable cvxCrvRewards;
    address public immutable locker;
    address public immutable owner;

    enum Options {
        ClaimCvxCrv, //1
        ClaimLockedCvx, //2
        ClaimLockedCvxStake, //4
        LockCrvDeposit, //8
        UseAllWalletFunds, //16
        LockCvx //32
    }

    /**
     * @param _crv                CRV token (0xD533a949740bb3306d119CC777fa900bA034cd52);
     * @param _cvx                CVX token (0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
     * @param _cvxCrv             cvxCRV token (0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
     * @param _crvDepositWrapper  crvDepositWrapper (0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae);
     * @param _cvxCrvRewards      cvxCrvRewards (0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e);
     * @param _locker             vlCVX (0xD18140b4B819b895A3dba5442F959fA44994AF50);
     */
    constructor(
        address _crv,
        address _cvx,
        address _cvxCrv,
        address _crvDepositWrapper,
        address _cvxCrvRewards,
        address _locker
    ) {
        crv = _crv;
        cvx = _cvx;
        cvxCrv = _cvxCrv;
        crvDepositWrapper = _crvDepositWrapper;
        cvxCrvRewards = _cvxCrvRewards;
        locker = _locker;
        owner = msg.sender;
    }

    function getName() external pure returns (string memory) {
        return "ClaimZap V2.0";
    }

    /**
     * @notice Approve spending of:
     *          crv     -> crvDepositor
     *          cvxCrv  -> cvxCrvRewards
     *          cvx     -> Locker
     */
    function setApprovals() external {
        require(msg.sender == owner, "!auth");

        IERC20(crv).safeApprove(crvDepositWrapper, 0);
        IERC20(crv).safeApprove(crvDepositWrapper, type(uint256).max);

        IERC20(cvxCrv).safeApprove(cvxCrvRewards, 0);
        IERC20(cvxCrv).safeApprove(cvxCrvRewards, type(uint256).max);

        IERC20(cvx).safeApprove(locker, 0);
        IERC20(cvx).safeApprove(locker, type(uint256).max);
    }

    /**
     * @notice Use bitmask to check if option flag is set
     */
    function _checkOption(uint256 _mask, uint256 _flag) internal pure returns (bool) {
        return (_mask & (1 << _flag)) != 0;
    }

    /**
     * @notice Claim all the rewards
     * @param rewardContracts       Array of addresses for LP token rewards
     * @param extraRewardContracts  Array of addresses for extra rewards
     * @param tokenRewardContracts  Array of addresses for token rewards e.g vlCvxExtraRewardDistribution
     * @param tokenRewardTokens     Array of token reward addresses to use with tokenRewardContracts
     * @param depositCrvMaxAmount   The max amount of CRV to deposit if converting to crvCvx
     * @param minAmountOut          The min amount out for crv:cvxCrv swaps if swapping. Set this to zero if you
     *                              want to use CrvDepositor instead of balancer swap
     * @param depositCvxMaxAmount   The max amount of CVX to deposit if locking CVX
     * @param options               Claim options
     */
    function claimRewards(
        address[] calldata rewardContracts,
        address[] calldata extraRewardContracts,
        address[] calldata tokenRewardContracts,
        address[] calldata tokenRewardTokens,
        uint256 depositCrvMaxAmount,
        uint256 minAmountOut,
        uint256 depositCvxMaxAmount,
        uint256 options
    ) external {
        require(tokenRewardContracts.length == tokenRewardTokens.length, "!parity");

        uint256 crvBalance = IERC20(crv).balanceOf(msg.sender);
        uint256 cvxBalance = IERC20(cvx).balanceOf(msg.sender);

        //claim from main curve LP pools
        for (uint256 i = 0; i < rewardContracts.length; i++) {
            IBasicRewards(rewardContracts[i]).getReward(msg.sender, true);
        }
        //claim from extra rewards
        for (uint256 i = 0; i < extraRewardContracts.length; i++) {
            IBasicRewards(extraRewardContracts[i]).getReward(msg.sender);
        }
        //claim from multi reward token contract
        for (uint256 i = 0; i < tokenRewardContracts.length; i++) {
            IBasicRewards(tokenRewardContracts[i]).getReward(msg.sender, tokenRewardTokens[i]);
        }

        // claim others/deposit/lock/stake
        _claimExtras(depositCrvMaxAmount, minAmountOut, depositCvxMaxAmount, crvBalance, cvxBalance, options);
    }

    /**
     * @notice  Claim additional rewards from:
     *          - cvxCrvRewards
     *          - cvxLocker
     * @param depositCrvMaxAmount see claimRewards
     * @param minAmountOut        see claimRewards
     * @param depositCvxMaxAmount see claimRewards
     * @param removeCrvBalance    crvBalance to ignore and not redeposit (starting Crv balance)
     * @param removeCvxBalance    cvxBalance to ignore and not redeposit (starting Cvx balance)
     * @param options             see claimRewards
     */
    // prettier-ignore
    function _claimExtras( // solhint-disable-line 
        uint256 depositCrvMaxAmount,
        uint256 minAmountOut,
        uint256 depositCvxMaxAmount,
        uint256 removeCrvBalance,
        uint256 removeCvxBalance,
        uint256 options
    ) internal {
        //claim from cvxCrv rewards
        if (_checkOption(options, uint256(Options.ClaimCvxCrv))) {
            IBasicRewards(cvxCrvRewards).getReward(msg.sender, true);
        }

        //claim from locker
        if (_checkOption(options, uint256(Options.ClaimLockedCvx))) {
            IAuraLocker(locker).getReward(msg.sender, _checkOption(options, uint256(Options.ClaimLockedCvxStake)));
        }

        //reset remove balances if we want to also stake/lock funds already in our wallet
        if (_checkOption(options, uint256(Options.UseAllWalletFunds))) {
            removeCrvBalance = 0;
            removeCvxBalance = 0;
        }

        //lock upto given amount of crv and stake
        if (depositCrvMaxAmount > 0) {
            uint256 crvBalance = IERC20(crv).balanceOf(msg.sender).sub(removeCrvBalance);
            crvBalance = AuraMath.min(crvBalance, depositCrvMaxAmount);

            if (crvBalance > 0) {
                //pull crv
                IERC20(crv).safeTransferFrom(msg.sender, address(this), crvBalance);
                //deposit
                ICrvDepositorWrapper(crvDepositWrapper).deposit(
                    crvBalance,
                    minAmountOut,
                    _checkOption(options, uint256(Options.LockCrvDeposit)),
                    address(0)
                );

                uint256 cvxCrvBalance = IERC20(cvxCrv).balanceOf(address(this));
                //stake for msg.sender
                IBasicRewards(cvxCrvRewards).stakeFor(msg.sender, cvxCrvBalance);
            }
        }

        //stake up to given amount of cvx
        if (depositCvxMaxAmount > 0) {
            uint256 cvxBalance = IERC20(cvx).balanceOf(msg.sender).sub(removeCvxBalance);
            cvxBalance = AuraMath.min(cvxBalance, depositCvxMaxAmount);
            if (cvxBalance > 0) {
                //pull cvx
                IERC20(cvx).safeTransferFrom(msg.sender, address(this), cvxBalance);
                if (_checkOption(options, uint256(Options.LockCvx))) {
                    IAuraLocker(locker).lock(msg.sender, cvxBalance);
                }
            }
        }
    }
}
