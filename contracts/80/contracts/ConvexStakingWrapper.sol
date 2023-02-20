// SPDX-License-Identifier: MIT
// Original contract: https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapper.sol
pragma solidity 0.8.6;

import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";
import "@yield-protocol/utils-v2/contracts/access/AccessControl.sol";
import "@yield-protocol/utils-v2/contracts/token/TransferHelper.sol";
import "./interfaces/IRewardStaking.sol";
import "./interfaces/IConvexDeposits.sol";
import "./interfaces/ICvx.sol";
import "./CvxMining.sol";

/// @notice Wrapper used to manage staking of Convex tokens
contract ConvexStakingWrapper is ERC20, AccessControl {
    using TransferHelper for IERC20;

    struct EarnedData {
        address token;
        uint256 amount;
    }

    struct RewardType {
        address reward_token;
        address reward_pool;
        uint128 reward_integral;
        uint128 reward_remaining;
        mapping(address => uint256) reward_integral_for;
        mapping(address => uint256) claimable_reward;
    }

    uint256 public cvx_reward_integral;
    uint256 public cvx_reward_remaining;
    mapping(address => uint256) public cvx_reward_integral_for;
    mapping(address => uint256) public cvx_claimable_reward;

    //constants/immutables
    address public constant convexBooster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public curveToken;
    address public convexToken;
    address public convexPool;
    address public collateralVault;
    uint256 public convexPoolId;

    //rewards
    RewardType[] public rewards;

    //management
    bool public isShutdown;
    bool private _status;

    bool private constant _NOT_ENTERED = false;
    bool private constant _ENTERED = true;

    event Deposited(address indexed _user, address indexed _account, uint256 _amount, bool _wrapped);
    event Withdrawn(address indexed _user, uint256 _amount, bool _unwrapped);

    constructor(
        address _curveToken,
        address _convexToken,
        address _convexPool,
        uint256 _poolId,
        address _vault,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol, decimals) {
        curveToken = _curveToken;
        convexToken = _convexToken;
        convexPool = _convexPool;
        convexPoolId = _poolId;
        collateralVault = _vault;

        //add rewards
        addRewards();
        setApprovals();
    }

    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
        _;
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /// @notice Give maximum approval to the pool & convex booster contract to transfer funds from wrapper
    function setApprovals() public {
        IERC20(curveToken).approve(convexBooster, 0);
        IERC20(curveToken).approve(convexBooster, type(uint256).max);
        IERC20(convexToken).approve(convexPool, type(uint256).max);
    }

    /// @notice Adds reward tokens by reading the available rewards from the RewardStaking pool
    /// @dev CRV token is added as a reward by default
    function addRewards() public {
        address mainPool = convexPool;

        uint256 rewardsLength = rewards.length;

        if (rewardsLength == 0) {
            RewardType storage reward = rewards.push();
            reward.reward_token = crv;
            reward.reward_pool = mainPool;
            rewardsLength += 1;
        }

        uint256 extraCount = IRewardStaking(mainPool).extraRewardsLength();
        uint256 startIndex = rewardsLength - 1;
        for (uint256 i = startIndex; i < extraCount; i++) {
            address extraPool = IRewardStaking(mainPool).extraRewards(i);
            RewardType storage reward = rewards.push();
            reward.reward_token = IRewardStaking(extraPool).rewardToken();
            reward.reward_pool = extraPool;
        }
    }

    /// @notice Returns the length of the reward tokens added
    /// @return The count of reward tokens
    function rewardLength() external view returns (uint256) {
        return rewards.length;
    }

    /// @notice Get user's balance
    /// @param _account User's address for which balance is requested
    /// @return User's balance of collateral
    /// @dev Included here to allow inheriting contracts to override.
    function _getDepositedBalance(address _account) internal view virtual returns (uint256) {
        if (_account == address(0) || _account == collateralVault) {
            return 0;
        }
        //get balance from collateralVault

        return _balanceOf[_account];
    }

    /// @notice TotalSupply of wrapped token
    /// @return The total supply of wrapped token
    /// @dev This function is provided and marked virtual as convenience to future development
    function _getTotalSupply() internal view virtual returns (uint256) {
        return _totalSupply;
    }

    /// @notice Calculates & upgrades the integral for distributing the CVX rewards
    /// @param _accounts Accounts for which the CvxIntegral has to be calculated
    /// @param _balances Balances of the accounts
    /// @param _supply Total supply of the wrapped token
    /// @param _isClaim Whether to claim the calculated rewards
    function _calcCvxIntegral(
        address[2] memory _accounts,
        uint256[2] memory _balances,
        uint256 _supply,
        bool _isClaim
    ) internal {
        uint256 bal = IERC20(cvx).balanceOf(address(this));
        uint256 cvxRewardRemaining = cvx_reward_remaining;
        uint256 d_cvxreward = bal - cvxRewardRemaining;
        uint256 cvxRewardIntegral = cvx_reward_integral;

        if (_supply > 0 && d_cvxreward > 0) {
            cvxRewardIntegral = cvxRewardIntegral + (d_cvxreward * 1e20) / (_supply);
            cvx_reward_integral = cvxRewardIntegral;
        }

        //update user integrals for cvx
        uint256 accountsLength = _accounts.length;
        for (uint256 u = 0; u < accountsLength; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            uint256 userI = cvx_reward_integral_for[_accounts[u]];
            if (_isClaim || userI < cvxRewardIntegral) {
                uint256 receiveable = cvx_claimable_reward[_accounts[u]] +
                    ((_balances[u] * (cvxRewardIntegral - userI)) / 1e20);
                if (_isClaim) {
                    if (receiveable > 0) {
                        cvx_claimable_reward[_accounts[u]] = 0;
                        IERC20(cvx).safeTransfer(_accounts[u], receiveable);
                        bal = bal - (receiveable);
                    }
                } else {
                    cvx_claimable_reward[_accounts[u]] = receiveable;
                }
                cvx_reward_integral_for[_accounts[u]] = cvxRewardIntegral;
            }
        }

        //update reward total
        if (bal != cvxRewardRemaining) {
            cvx_reward_remaining = bal;
        }
    }

    /// @notice Calculates & upgrades the integral for distributing the reward token
    /// @param _index The index of the reward token for which the calculations are to be done
    /// @param _accounts Accounts for which the CvxIntegral has to be calculated
    /// @param _balances Balances of the accounts
    /// @param _supply Total supply of the wrapped token
    /// @param _isClaim Whether to claim the calculated rewards
    function _calcRewardIntegral(
        uint256 _index,
        address[2] memory _accounts,
        uint256[2] memory _balances,
        uint256 _supply,
        bool _isClaim
    ) internal {
        RewardType storage reward = rewards[_index];

        uint256 rewardIntegral = reward.reward_integral;
        uint256 rewardRemaining = reward.reward_remaining;

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use reward_remaining to keep track of how much was actually claimed
        uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));
        if (_supply > 0 && (bal - rewardRemaining) > 0) {
            rewardIntegral = uint128(rewardIntegral) + uint128(((bal - rewardRemaining) * 1e20) / _supply);
            reward.reward_integral = uint128(rewardIntegral);
        }
        //update user integrals
        uint256 accountsLength = _accounts.length;
        for (uint256 u = 0; u < accountsLength; u++) {
            //do not give rewards to address 0
            if (_accounts[u] == address(0)) continue;
            if (_accounts[u] == collateralVault) continue;

            uint256 userI = reward.reward_integral_for[_accounts[u]];
            if (_isClaim || userI < rewardIntegral) {
                if (_isClaim) {
                    uint256 receiveable = reward.claimable_reward[_accounts[u]] +
                        ((_balances[u] * (uint256(rewardIntegral) - userI)) / 1e20);
                    if (receiveable > 0) {
                        reward.claimable_reward[_accounts[u]] = 0;
                        IERC20(reward.reward_token).safeTransfer(_accounts[u], receiveable);
                        bal = bal - receiveable;
                    }
                } else {
                    reward.claimable_reward[_accounts[u]] =
                        reward.claimable_reward[_accounts[u]] +
                        ((_balances[u] * (uint256(rewardIntegral) - userI)) / 1e20);
                }
                reward.reward_integral_for[_accounts[u]] = rewardIntegral;
            }
        }

        //update remaining reward here since balance could have changed if claiming
        if (bal != rewardRemaining) {
            reward.reward_remaining = uint128(bal);
        }
    }

    /// @notice Create a checkpoint for the supplied addresses by updating the reward integrals & claimable reward for them
    /// @param _accounts The accounts for which checkpoints have to be calculated
    function _checkpoint(address[2] memory _accounts) internal {
        //if shutdown, no longer checkpoint in case there are problems
        if (isShutdown) return;

        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]);
        depositedBalance[1] = _getDepositedBalance(_accounts[1]);

        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
            _calcRewardIntegral(i, _accounts, depositedBalance, supply, false);
        }
        _calcCvxIntegral(_accounts, depositedBalance, supply, false);
    }

    /// @notice Create a checkpoint for the supplied addresses by updating the reward integrals & claimable reward for them & claims the rewards
    /// @param _accounts The accounts for which checkpoints have to be calculated
    function _checkpointAndClaim(address[2] memory _accounts) internal {
        uint256 supply = _getTotalSupply();
        uint256[2] memory depositedBalance;
        depositedBalance[0] = _getDepositedBalance(_accounts[0]); //only do first slot

        IRewardStaking(convexPool).getReward(address(this), true);

        uint256 rewardCount = rewards.length;
        for (uint256 i = 0; i < rewardCount; i++) {
            _calcRewardIntegral(i, _accounts, depositedBalance, supply, true);
        }
        _calcCvxIntegral(_accounts, depositedBalance, supply, true);
    }

    /// @notice Create a checkpoint for the supplied addresses by updating the reward integrals & claimable reward for them
    /// @param _accounts The accounts for which checkpoints have to be calculated
    function user_checkpoint(address[2] calldata _accounts) external returns (bool) {
        _checkpoint([_accounts[0], _accounts[1]]);
        return true;
    }

    /// @notice Get the balance of the user
    /// @param _account Address whose balance is to be checked
    /// @return The balance of the supplied address
    function totalBalanceOf(address _account) external view returns (uint256) {
        return _getDepositedBalance(_account);
    }

    /// @notice Get the amount of tokens the user has earned
    /// @param _account Address whose balance is to be checked
    /// @return claimable Array of earned tokens and their amount
    function earned(address _account) external view returns (EarnedData[] memory claimable) {
        uint256 supply = _getTotalSupply();
        uint256 rewardCount = rewards.length;
        claimable = new EarnedData[](rewardCount + 1);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];
            address rewardToken = reward.reward_token;

            //change in reward is current balance - remaining reward + earned
            uint256 bal = IERC20(rewardToken).balanceOf(address(this));
            uint256 d_reward = bal - reward.reward_remaining;
            d_reward = d_reward + IRewardStaking(reward.reward_pool).earned(address(this));

            uint256 I = reward.reward_integral;
            if (supply > 0) {
                I = I + (d_reward * 1e20) / supply;
            }

            uint256 newlyClaimable = (_getDepositedBalance(_account) * (I - reward.reward_integral_for[_account])) /
                1e20;
            claimable[i].amount = reward.claimable_reward[_account] + newlyClaimable;
            claimable[i].token = rewardToken;

            //calc cvx here
            if (rewardToken == crv) {
                claimable[rewardCount].amount =
                    cvx_claimable_reward[_account] +
                    CvxMining.ConvertCrvToCvx(newlyClaimable);
                claimable[rewardCount].token = cvx;
            }
        }
        return claimable;
    }

    /// @notice Claim reward for the supplied account
    /// @param _account Address whose reward is to be claimed
    function getReward(address _account) external {
        //claim directly in checkpoint logic to save a bit of gas
        _checkpointAndClaim([_account, address(0)]);
    }
}
