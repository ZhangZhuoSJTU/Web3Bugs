// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./external/ConvexInterfaces.sol";
import "./interfaces/IConcurRewardClaim.sol";
import "./MasterChef.sol";

contract ConvexStakingWrapper is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct RewardType {
        address token;
        address pool;
        uint128 integral;
        uint128 remaining;
    }

    struct Reward {
        uint128 integral;
    }

    //constants/immutables
    address public constant convexBooster =
        address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv =
        address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx =
        address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);

    uint256 public constant CRV_INDEX = 0;
    uint256 public constant CVX_INDEX = 1;
    uint256 public constant VOTECYCLE_START = 1645002000; //Feb 16 2022 09:00:00 GMT+0000
    MasterChef public immutable masterChef;

    //convex rewards
    mapping(uint256 => address) public convexPool;
    mapping(uint256 => RewardType[]) public rewards;
    mapping(uint256 => mapping(uint256 => mapping(address => Reward)))
        public userReward;
    mapping(uint256 => mapping(address => uint256)) public registeredRewards;

    //management
    address public treasury;
    IConcurRewardClaim public claimContract;

    struct Deposit {
        uint64 epoch;
        uint192 amount;
    }

    struct WithdrawRequest {
        uint64 epoch;
        uint192 amount;
    }

    mapping(address => uint256) public pids;
    mapping(uint256 => mapping(address => Deposit)) public deposits;
    mapping(uint256 => mapping(address => WithdrawRequest)) public withdrawRequest;

    event Deposited(address indexed _user, uint256 _amount);
    event Withdrawn(address indexed _user, uint256 _amount);

    constructor(address _treasury, MasterChef _masterChef) {
        treasury = _treasury;
        masterChef = _masterChef;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function changeTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setRewardPool(address _claimContract) external onlyOwner {
        claimContract = IConcurRewardClaim(_claimContract);
    }

    /// @notice function to bootstrap the reward pool and extra rewards of convex booster
    /// @dev should be able to be called more than once
    /// @param _pid pid of the curve lp. same as convex booster pid
    function addRewards(uint256 _pid) public {
        address mainPool = IRewardStaking(convexBooster)
            .poolInfo(_pid)
            .crvRewards;
        if (rewards[_pid].length == 0) {
            pids[IRewardStaking(convexBooster).poolInfo(_pid).lptoken] = _pid;
            convexPool[_pid] = mainPool;
            rewards[_pid].push(
                RewardType({
                    token: crv,
                    pool: mainPool,
                    integral: 0,
                    remaining: 0
                })
            );
            rewards[_pid].push(
                RewardType({
                    token: cvx,
                    pool: address(0),
                    integral: 0,
                    remaining: 0
                })
            );
            registeredRewards[_pid][crv] = CRV_INDEX + 1; //mark registered at index+1
            registeredRewards[_pid][cvx] = CVX_INDEX + 1; //mark registered at index+1
        }

        uint256 extraCount = IRewardStaking(mainPool).extraRewardsLength();
        for (uint256 i = 0; i < extraCount; i++) {
            address extraPool = IRewardStaking(mainPool).extraRewards(i);
            address extraToken = IRewardStaking(extraPool).rewardToken();
            if (extraToken == cvx) {
                //no-op for cvx, crv rewards
                rewards[_pid][CVX_INDEX].pool = extraPool;
            } else if (registeredRewards[_pid][extraToken] == 0) {
                //add new token to list
                rewards[_pid].push(
                    RewardType({
                        token: IRewardStaking(extraPool).rewardToken(),
                        pool: extraPool,
                        integral: 0,
                        remaining: 0
                    })
                );
                registeredRewards[_pid][extraToken] = rewards[_pid].length; //mark registered at index+1
            }
        }
    }

    function rewardLength(uint256 _pid) external view returns (uint256) {
        return rewards[_pid].length;
    }

    function _getDepositedBalance(uint256 _pid, address _account)
        internal
        view
        virtual
        returns (uint256)
    {
        return deposits[_pid][_account].amount;
    }

    function _getTotalSupply(uint256 _pid)
        internal
        view
        virtual
        returns (uint256)
    {
        return IRewardStaking(convexPool[_pid]).balanceOf(address(this));
    }

    function _calcRewardIntegral(
        uint256 _pid,
        uint256 _index,
        address _account,
        uint256 _balance,
        uint256 _supply
    ) internal {
        RewardType memory reward = rewards[_pid][_index];

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use remaining to keep track of how much was actually claimed
        uint256 bal = IERC20(reward.token).balanceOf(address(this));
        uint256 d_reward = bal - reward.remaining;
        // send 20 % of cvx / crv reward to treasury
        if (reward.token == cvx || reward.token == crv) {
            IERC20(reward.token).transfer(treasury, d_reward / 5);
            d_reward = (d_reward * 4) / 5;
        }
        IERC20(reward.token).transfer(address(claimContract), d_reward);

        if (_supply > 0 && d_reward > 0) {
            reward.integral =
                reward.integral +
                uint128((d_reward * 1e20) / _supply);
        }

        //update user integrals
        uint256 userI = userReward[_pid][_index][_account].integral;
        if (userI < reward.integral) {
            userReward[_pid][_index][_account].integral = reward.integral;
            claimContract.pushReward(
                _account,
                reward.token,
                (_balance * (reward.integral - userI)) / 1e20
            );
        }

        //update remaining reward here since balance could have changed if claiming
        if (bal != reward.remaining) {
            reward.remaining = uint128(bal);
        }

        rewards[_pid][_index] = reward;
    }

    function _checkpoint(uint256 _pid, address _account) internal {
        //if shutdown, no longer checkpoint in case there are problems
        if (paused()) return;

        uint256 supply = _getTotalSupply(_pid);
        uint256 depositedBalance = _getDepositedBalance(_pid, _account);

        IRewardStaking(convexPool[_pid]).getReward(address(this), true);

        uint256 rewardCount = rewards[_pid].length;
        for (uint256 i = 0; i < rewardCount; i++) {
            _calcRewardIntegral(_pid, i, _account, depositedBalance, supply);
        }
    }

    /// @notice deposit curve lp token
    /// @dev should approve curve lp token to this address before calling this function
    /// @param _pid pid to deposit, uses same pid as convex booster
    /// @param _amount amount to withdraw
    function deposit(uint256 _pid, uint256 _amount)
        external
        whenNotPaused
        nonReentrant
    {
        _checkpoint(_pid, msg.sender);
        deposits[_pid][msg.sender].epoch = currentEpoch();
        deposits[_pid][msg.sender].amount += uint192(_amount);
        if (_amount > 0) {
            IERC20 lpToken = IERC20(
                IRewardStaking(convexPool[_pid]).poolInfo(_pid).lptoken
            );

            lpToken.safeTransferFrom(msg.sender, address(this), _amount);
            lpToken.safeApprove(convexBooster, _amount);
            IConvexDeposits(convexBooster).deposit(_pid, _amount, true);
            lpToken.safeApprove(convexBooster, 0);
            uint256 pid = masterChef.pid(address(lpToken));
            masterChef.deposit(msg.sender, pid, _amount);
        }

        emit Deposited(msg.sender, _amount);
    }

    /// @notice withdraw curve lp token
    /// @dev should request withdraw before calling this function
    /// @param _pid pid to withdraw, uses same pid as convex booster
    /// @param _amount amount to withdraw
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        WithdrawRequest memory request = withdrawRequest[_pid][msg.sender];
        require(request.epoch < currentEpoch() && deposits[_pid][msg.sender].epoch + 1 < currentEpoch(), "wait");
        require(request.amount >= _amount, "too much");
        _checkpoint(_pid, msg.sender);
        deposits[_pid][msg.sender].amount -= uint192(_amount);
        if (_amount > 0) {
            IRewardStaking(convexPool[_pid]).withdrawAndUnwrap(_amount, false);
            IERC20 lpToken = IERC20(
                IRewardStaking(convexPool[_pid]).poolInfo(_pid).lptoken
            );
            lpToken.safeTransfer(msg.sender, _amount);
            uint256 pid = masterChef.pid(address(lpToken));
            masterChef.withdraw(msg.sender, pid, _amount);
        }
        delete withdrawRequest[_pid][msg.sender];
        //events
        emit Withdrawn(msg.sender, _amount);
    }

    /// @notice epoch for voting cycle
    /// @return returns the epoch in uint64 type
    function currentEpoch() public view returns(uint64) {
        return uint64((block.timestamp - VOTECYCLE_START) / 2 weeks) + 1;
    }

    /// @notice request withdraw to be eligible for withdrawal after currentEpoch
    /// @dev prior withdrawal request will be overwritten
    /// @param _pid pid to withdraw
    /// @param _amount amount to request withdrawal
    function requestWithdraw(uint256 _pid, uint256 _amount) external {
        require(_amount <= uint256(deposits[_pid][msg.sender].amount), "too much");
        withdrawRequest[_pid][msg.sender] = WithdrawRequest({
            epoch : currentEpoch(),
            amount : uint192(_amount)
        });
    }
}
