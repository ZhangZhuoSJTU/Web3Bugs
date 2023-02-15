// SPDX-License-Identifier: MIT


pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract MasterChef is Ownable, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    event Deposit(address indexed _user, uint indexed _pid, uint _amount);
    event Withdraw(address indexed _user, uint indexed _pid, uint _amount);
    event EmergencyWithdraw(address indexed user, uint indexed _pid, uint _amount);

    struct UserInfo {
        uint128 amount; // How many tokens the user has provided.
        uint128 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of RADSs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accumlatedConcurPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accumlatedConcurPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 depositToken; // Address of LP token contract.
        uint allocPoint; // How many allocation points assigned to this pool. to distribute per block.
        uint lastRewardBlock; // Last block number that distribution occurs.
        uint accConcurPerShare; // Accumulated per share, times multiplier. See below.
        uint16 depositFeeBP; // Deposit fee in basis points
    }

    PoolInfo[] public poolInfo;
    mapping(uint => mapping(address => UserInfo)) public userInfo; // Info of each user that stakes LP tokens.
    mapping(address => bool) public isDepositor;
    mapping(address => uint256) public pid; // pid mapped to token
    uint public concurPerBlock = 100000 gwei; // concur tokens transferred per block
    uint public totalAllocPoint = 0; // Total allocation points. Must be the sum of all allocation points in all pools.
    uint public startBlock;
    uint public endBlock; // The block number when mining starts.
    IERC20 public concur;

    uint private _concurShareMultiplier = 1e18;
    uint private _perMille = 1000; // 100%

    constructor(IERC20 _concur, uint _startBlock, uint _endBlock) Ownable() {
        startBlock = _startBlock;
        endBlock = _endBlock;
        concur = _concur;
        poolInfo.push(
            PoolInfo({
            depositToken: IERC20(address(0)),
            allocPoint : 0,
            lastRewardBlock : _startBlock,
            accConcurPerShare : 0,
            depositFeeBP : 0
        }));
    }

    modifier onlyDepositor() {
        require(isDepositor[msg.sender], "!depositor");
        _;
    }

    function addDepositor(address _depositor) external onlyOwner {
        isDepositor[_depositor] = true;
    }

    function removeDepositor(address _depositor) external onlyOwner {
        isDepositor[_depositor] = false;
    }

    function add(address _token, uint _allocationPoints, uint16 _depositFee, uint _startBlock) public onlyOwner {
        require(_token != address(0), "zero address");
        uint lastRewardBlock = block.number > _startBlock ? block.number : _startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocationPoints);
        require(pid[_token] == 0, "already registered"); // pid starts from 0
        poolInfo.push(
            PoolInfo({
                depositToken: IERC20(_token),
                allocPoint: _allocationPoints,
                lastRewardBlock: lastRewardBlock,
                accConcurPerShare: 0,
                depositFeeBP: _depositFee
            })
        );
        pid[_token] = poolInfo.length - 1;
    }

    function poolLength() external view returns (uint) {
        return poolInfo.length;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint _from, uint _to) public pure returns (uint) {
        return _to.sub(_from);
    }

    // View function to see pending [concur] on frontend.
    function pendingConcur(uint _pid, address _user) external view returns (uint) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint accConcurPerShare = pool.accConcurPerShare;
        uint lpSupply = pool.depositToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint concurReward = multiplier.mul(concurPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accConcurPerShare = accConcurPerShare.add(concurReward.mul(_concurShareMultiplier).div(lpSupply));
        }
        return user.amount * accConcurPerShare / _concurShareMultiplier - user.rewardDebt;
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint length = poolInfo.length;
        for (uint _pid = 0; _pid < length; ++_pid) {
            updatePool(_pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint lpSupply = pool.depositToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        if(block.number >= endBlock) {
            pool.lastRewardBlock = block.number;
            return;
        }        

        uint multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint concurReward = multiplier.mul(concurPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accConcurPerShare = pool.accConcurPerShare.add(concurReward.mul(_concurShareMultiplier).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit tokens for [concur] allocation.  
    function deposit(address _recipient, uint _pid, uint _amount) external nonReentrant onlyDepositor {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        updatePool(_pid);
       
        if(user.amount > 0) {  
            uint pending = user.amount * pool.accConcurPerShare / _concurShareMultiplier - user.rewardDebt;
            if (pending > 0) {
                safeConcurTransfer(_recipient, pending);
            }
        }

        if (_amount > 0) {
            if (pool.depositFeeBP > 0) {
                uint depositFee = _amount.mul(pool.depositFeeBP).div(_perMille);
                user.amount = SafeCast.toUint128(user.amount + _amount - depositFee);
            } else {
                user.amount = SafeCast.toUint128(user.amount + _amount);
            }
        }     

        user.rewardDebt = SafeCast.toUint128(user.amount * pool.accConcurPerShare / _concurShareMultiplier);
        emit Deposit(_recipient, _pid, _amount);
    }

    // Withdraw tokens
    function withdraw(address _recipient, uint _pid, uint _amount) external nonReentrant onlyDepositor {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(user.amount > 0, "MasterChef: nothing to withdraw");
        require(user.amount >= _amount, "MasterChef: withdraw not allowed");
        updatePool(_pid);

        uint pending = user.amount * pool.accConcurPerShare / _concurShareMultiplier - user.rewardDebt;
        if(pending > 0) {
            safeConcurTransfer(_recipient, pending);
        }
        if (_amount > 0) {
            user.amount = SafeCast.toUint128(user.amount - _amount);
        }
        user.rewardDebt = SafeCast.toUint128(user.amount * pool.accConcurPerShare / _concurShareMultiplier);
        emit Withdraw(_recipient, _pid, _amount);
    }

    // Safe [concur] transfer function, just in case if rounding error causes pool to not have enough
    function safeConcurTransfer(address _to, uint _amount) private {
        uint concurBalance = concur.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > concurBalance) {
            transferSuccess = concur.transfer(_to, concurBalance);
        } else {
            transferSuccess = concur.transfer(_to, _amount);
        }
        require(transferSuccess, "safeConcurTransfer: transfer failed");
    }
}
