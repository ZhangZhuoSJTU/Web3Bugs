// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/Errors.sol";

import "../../interfaces/vendor/IBooster.sol";
import "../../interfaces/vendor/IRewardStaking.sol";
import "../../interfaces/tokenomics/IAmmConvexGauge.sol";
import "./AmmGauge.sol";
import "../utils/CvxMintAmount.sol";

contract AmmConvexGauge is IAmmConvexGauge, AmmGauge, CvxMintAmount {
    using ScaledMath for uint256;
    using SafeERC20 for IERC20;
    address public immutable cvx;
    address public immutable crv;
    address public immutable booster;
    address public inflationRecipient;

    uint256 public immutable bkdPoolPID; // bkd pool id on Convex
    IRewardStaking public immutable crvRewardsContract; // Staking contract for bkd convex deposit token

    // Additional integrals etc. for crv and cvx rewards
    uint256 public crvStakedIntegral;
    uint256 public cvxStakedIntegral;
    mapping(address => uint256) public perUserCrvStakedIntegral;
    mapping(address => uint256) public perUserCvxStakedIntegral;
    mapping(address => uint256) public perUserShareCrv;
    mapping(address => uint256) public perUserShareCvx;

    uint256 private _crvLastEarned;
    uint256 private _cvxLastEarned;

    event RewardClaimed(
        address indexed beneficiary,
        uint256 bkdAmount,
        uint256 crvAmount,
        uint256 cvxAmount
    );

    constructor(
        IController _controller,
        address _ammToken,
        uint256 _bkdPoolPID,
        address _crv,
        address _cvx,
        address _booster
    ) AmmGauge(_controller, _ammToken) {
        cvx = _cvx;
        crv = _crv;
        booster = _booster;
        bkdPoolPID = _bkdPoolPID;
        (, , , address _crvRewards, , ) = IBooster(booster).poolInfo(_bkdPoolPID);
        crvRewardsContract = IRewardStaking(_crvRewards);

        // approve for Convex deposit
        IERC20(ammToken).safeApprove(booster, type(uint256).max);
    }

    function claimRewards(address beneficiary) external virtual override returns (uint256) {
        require(
            msg.sender == beneficiary || _roleManager().hasRole(Roles.GAUGE_ZAP, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        _userCheckpoint(beneficiary);
        uint256 amount = perUserShare[beneficiary];
        uint256 crvAmount = perUserShareCrv[beneficiary];
        uint256 cvxAmount = perUserShareCvx[beneficiary];
        if (amount <= 0 && crvAmount <= 0 && cvxAmount <= 0) return 0;
        perUserShare[beneficiary] = 0;
        perUserShareCrv[beneficiary] = 0;
        perUserShareCvx[beneficiary] = 0;
        _crvLastEarned -= crvAmount;
        _cvxLastEarned -= cvxAmount;
        IController(controller).inflationManager().mintRewards(beneficiary, amount);
        IERC20(crv).safeTransfer(beneficiary, crvAmount);
        IERC20(cvx).safeTransfer(beneficiary, cvxAmount);
        emit RewardClaimed(beneficiary, amount, crvAmount, cvxAmount);
        return amount;
    }

    function setInflationRecipient(address recipient) external override onlyGovernance {
        require(inflationRecipient == address(0), Error.ADDRESS_ALREADY_SET);
        poolCheckpoint();
        inflationRecipient = recipient;
    }

    function deactivateInflationRecipient() external override onlyGovernance {
        require(inflationRecipient != address(0), Error.ADDRESS_NOT_FOUND);
        poolCheckpoint();
        inflationRecipient = address(0);
    }

    function claimableRewards(address user) external view virtual override returns (uint256) {
        uint256 ammStakedIntegral_ = ammStakedIntegral;
        uint256 timeElapsed = block.timestamp - uint256(ammLastUpdated);
        if (user == inflationRecipient) {
            return
                perUserShare[inflationRecipient] +
                IController(controller).inflationManager().getAmmRateForToken(ammToken) *
                timeElapsed;
        }
        if (!killed && totalStaked > 0) {
            ammStakedIntegral_ +=
                IController(controller).inflationManager().getAmmRateForToken(ammToken) *
                timeElapsed.scaledDiv(totalStaked);
        }
        return
            perUserShare[user] +
            balances[user].scaledMul(ammStakedIntegral_ - perUserStakedIntegral[user]);
    }

    function allClaimableRewards(address user) external view override returns (uint256[3] memory) {
        uint256 ammStakedIntegral_ = ammStakedIntegral;
        uint256 crvStakedIntegral_ = crvStakedIntegral;
        uint256 cvxStakedIntegral_ = cvxStakedIntegral;
        uint256 timeElapsed = block.timestamp - uint256(ammLastUpdated);

        // This might lead to some inaccuracies in between poolCheckpoints if someone sends CRV
        uint256 crvEarned = IERC20(crv).balanceOf(address(this)) +
            crvRewardsContract.earned(address(this)) -
            _crvLastEarned;
        uint256 cvxEarned = getCvxMintAmount(crvEarned);

        if (!killed && totalStaked > 0) {
            if (inflationRecipient == address(0)) {
                ammStakedIntegral_ +=
                    (IController(controller).inflationManager().getAmmRateForToken(ammToken)) *
                    (timeElapsed).scaledDiv(totalStaked);
            }
            crvStakedIntegral_ += (crvEarned).scaledDiv(totalStaked);
            cvxStakedIntegral_ += (cvxEarned).scaledDiv(totalStaked);
        }
        uint256 bkdRewards;
        if (user == inflationRecipient) {
            bkdRewards =
                perUserShare[user] +
                IController(controller).inflationManager().getAmmRateForToken(ammToken) *
                timeElapsed;
        } else {
            bkdRewards =
                perUserShare[user] +
                balances[user].scaledMul(ammStakedIntegral_ - perUserStakedIntegral[user]);
        }
        uint256 crvRewards = perUserShareCrv[user] +
            balances[user].scaledMul(crvStakedIntegral_ - perUserCrvStakedIntegral[user]);
        uint256 cvxRewards = perUserShareCvx[user] +
            balances[user].scaledMul(cvxStakedIntegral_ - perUserCvxStakedIntegral[user]);
        uint256[3] memory allRewards = [bkdRewards, crvRewards, cvxRewards];
        return allRewards;
    }

    function stakeFor(address account, uint256 amount) public virtual override returns (bool) {
        require(amount > 0, Error.INVALID_AMOUNT);

        _userCheckpoint(account);

        IERC20(ammToken).safeTransferFrom(msg.sender, address(this), amount);
        IBooster(booster).deposit(bkdPoolPID, amount, true);
        balances[account] += amount;
        totalStaked += amount;
        emit AmmStaked(account, ammToken, amount);
        return true;
    }

    function unstakeFor(address dst, uint256 amount) public virtual override returns (bool) {
        require(amount > 0, Error.INVALID_AMOUNT);
        require(balances[msg.sender] >= amount, Error.INSUFFICIENT_BALANCE);

        _userCheckpoint(msg.sender);

        crvRewardsContract.withdrawAndUnwrap(amount, false);
        IERC20(ammToken).safeTransfer(dst, amount);
        balances[msg.sender] -= amount;
        totalStaked -= amount;
        emit AmmUnstaked(msg.sender, ammToken, amount);
        return true;
    }

    function poolCheckpoint() public virtual override returns (bool) {
        if (killed) {
            return false;
        }
        uint256 timeElapsed = block.timestamp - uint256(ammLastUpdated);
        uint256 currentRate = IController(controller).inflationManager().getAmmRateForToken(
            ammToken
        );
        crvRewardsContract.getReward();
        uint256 crvEarned = IERC20(crv).balanceOf(address(this));
        uint256 cvxEarned = IERC20(cvx).balanceOf(address(this));

        // Update the integral of total token supply for the pool
        if (totalStaked > 0) {
            if (inflationRecipient == address(0)) {
                ammStakedIntegral += (currentRate * timeElapsed).scaledDiv(totalStaked);
            } else {
                perUserShare[inflationRecipient] += currentRate * timeElapsed;
            }
            crvStakedIntegral += (crvEarned - _crvLastEarned).scaledDiv(totalStaked);
            cvxStakedIntegral += (cvxEarned - _cvxLastEarned).scaledDiv(totalStaked);
        }
        _crvLastEarned = crvEarned;
        _cvxLastEarned = cvxEarned;
        ammLastUpdated = uint48(block.timestamp);
        return true;
    }

    function _userCheckpoint(address user) internal virtual override returns (bool) {
        poolCheckpoint();
        perUserShare[user] += balances[user].scaledMul(
            ammStakedIntegral - perUserStakedIntegral[user]
        );
        perUserShareCrv[user] += balances[user].scaledMul(
            crvStakedIntegral - perUserCrvStakedIntegral[user]
        );
        perUserShareCvx[user] += balances[user].scaledMul(
            cvxStakedIntegral - perUserCvxStakedIntegral[user]
        );
        perUserStakedIntegral[user] = ammStakedIntegral;
        perUserCrvStakedIntegral[user] = crvStakedIntegral;
        perUserCvxStakedIntegral[user] = cvxStakedIntegral;
        return true;
    }
}
