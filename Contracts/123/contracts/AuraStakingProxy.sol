// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { Address } from "@openzeppelin/contracts-0.8/utils/Address.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import { IAuraLocker, ICrvDepositorWrapper } from "./Interfaces.sol";

/**
 * @title   AuraStakingProxy
 * @author  adapted from ConvexFinance
 * @notice  Receives CRV from the Booster as overall reward, then convers to cvxCRV and distributes to vlCVX holders.
 * @dev     From CVX:
 *           - receive tokens to stake
 *           - get current staked balance
 *           - withdraw staked tokens
 *           - send rewards back to owner(cvx locker)
 *           - register token types that can be distributed
 */
contract AuraStakingProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    //tokens
    address public immutable crv;
    address public immutable cvx;
    address public immutable cvxCrv;

    address public keeper;
    address public crvDepositorWrapper;
    uint256 public outputBps;
    uint256 public constant denominator = 10000;

    address public rewards;

    address public owner;
    address public pendingOwner;
    uint256 public callIncentive = 25;

    event RewardsDistributed(address indexed token, uint256 amount);
    event CallIncentiveChanged(uint256 incentive);

    /* ========== CONSTRUCTOR ========== */

    /**
     * @param _rewards       vlCVX
     * @param _crv           CRV token
     * @param _cvx           CVX token
     * @param _cvxCrv        cvxCRV token
     * @param _crvDepositorWrapper    Wrapper that converts CRV to CRVBPT and deposits
     * @param _outputBps     Configurable output bps where 100% == 10000
     */
    constructor(
        address _rewards,
        address _crv,
        address _cvx,
        address _cvxCrv,
        address _crvDepositorWrapper,
        uint256 _outputBps
    ) {
        rewards = _rewards;
        owner = msg.sender;
        crv = _crv;
        cvx = _cvx;
        cvxCrv = _cvxCrv;
        crvDepositorWrapper = _crvDepositorWrapper;
        outputBps = _outputBps;
    }

    /**
     * @notice Set CrvDepositorWrapper
     * @param   _crvDepositorWrapper CrvDepositorWrapper address
     * @param   _outputBps Min output base points
     */
    function setCrvDepositorWrapper(address _crvDepositorWrapper, uint256 _outputBps) external {
        require(msg.sender == owner, "!auth");
        require(_outputBps > 9000 && _outputBps < 10000, "Invalid output bps");

        crvDepositorWrapper = _crvDepositorWrapper;
        outputBps = _outputBps;
    }

    /**
     * @notice Set keeper
     */
    function setKeeper(address _keeper) external {
        require(msg.sender == owner, "!auth");
        keeper = _keeper;
    }

    /**
     * @notice Set pending owner
     */
    function setPendingOwner(address _po) external {
        require(msg.sender == owner, "!auth");
        pendingOwner = _po;
    }

    /**
     * @notice Apply pending owner
     */
    function applyPendingOwner() external {
        require(msg.sender == owner, "!auth");
        require(pendingOwner != address(0), "invalid owner");

        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @notice Set call incentive
     * @param _incentive Incentive base points
     */
    function setCallIncentive(uint256 _incentive) external {
        require(msg.sender == owner, "!auth");
        require(_incentive <= 100, "too high");
        callIncentive = _incentive;
        emit CallIncentiveChanged(_incentive);
    }

    /**
     * @notice Set reward address
     */
    function setRewards(address _rewards) external {
        require(msg.sender == owner, "!auth");
        rewards = _rewards;
    }

    /**
     * @notice  Approve crvDepositorWrapper to transfer contract CRV
     *          and rewards to transfer cvxCrv
     */
    function setApprovals() external {
        IERC20(crv).safeApprove(crvDepositorWrapper, 0);
        IERC20(crv).safeApprove(crvDepositorWrapper, type(uint256).max);

        IERC20(cvxCrv).safeApprove(rewards, 0);
        IERC20(cvxCrv).safeApprove(rewards, type(uint256).max);
    }

    /**
     * @notice Transfer stuck ERC20 tokens to `_to`
     */
    function rescueToken(address _token, address _to) external {
        require(msg.sender == owner, "!auth");
        require(_token != crv && _token != cvx && _token != cvxCrv, "not allowed");

        uint256 bal = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_to, bal);
    }

    /**
     * @dev Collects cvxCRV rewards from cvxRewardPool, converts any CRV deposited directly from
     *      the booster, and then applies the rewards to the cvxLocker, rewarding the caller in the process.
     */
    function distribute() external {
        // If keeper enabled, require
        if (keeper != address(0)) {
            require(msg.sender == keeper, "!auth");
        }

        //convert crv to cvxCrv
        uint256 crvBal = IERC20(crv).balanceOf(address(this));
        if (crvBal > 0) {
            uint256 minOut = ICrvDepositorWrapper(crvDepositorWrapper).getMinOut(crvBal, outputBps);
            ICrvDepositorWrapper(crvDepositorWrapper).deposit(crvBal, minOut, true, address(0));
        }

        //distribute cvxcrv
        uint256 cvxCrvBal = IERC20(cvxCrv).balanceOf(address(this));

        if (cvxCrvBal > 0) {
            uint256 incentiveAmount = cvxCrvBal.mul(callIncentive).div(denominator);
            cvxCrvBal = cvxCrvBal.sub(incentiveAmount);

            //send incentives
            IERC20(cvxCrv).safeTransfer(msg.sender, incentiveAmount);

            //update rewards
            IAuraLocker(rewards).queueNewRewards(cvxCrvBal);

            emit RewardsDistributed(cvxCrv, cvxCrvBal);
        }
    }

    /**
     * @notice Allow generic token distribution in case a new reward is ever added
     */
    function distributeOther(IERC20 _token) external {
        require(address(_token) != crv && address(_token) != cvxCrv, "not allowed");

        uint256 bal = _token.balanceOf(address(this));

        if (bal > 0) {
            uint256 incentiveAmount = bal.mul(callIncentive).div(denominator);
            bal = bal.sub(incentiveAmount);

            //send incentives
            _token.safeTransfer(msg.sender, incentiveAmount);

            //approve
            _token.safeApprove(rewards, 0);
            _token.safeApprove(rewards, type(uint256).max);

            //update rewards
            IAuraLocker(rewards).notifyRewardAmount(address(_token), bal);

            emit RewardsDistributed(address(_token), bal);
        }
    }
}
