pragma solidity 0.6.12;


//----------------------------------------------------------------------------------
//    I n s t a n t
//
//        .:mmm.         .:mmm:.       .ii.  .:SSSSSSSSSSSSS.     .oOOOOOOOOOOOo.  
//      .mMM'':Mm.     .:MM'':Mm:.     .II:  :SSs..........     .oOO'''''''''''OOo.
//    .:Mm'   ':Mm.   .:Mm'   'MM:.    .II:  'sSSSSSSSSSSSSS:.  :OO.           .OO:
//  .'mMm'     ':MM:.:MMm'     ':MM:.  .II:  .:...........:SS.  'OOo:.........:oOO'
//  'mMm'        ':MMmm'         'mMm:  II:  'sSSSSSSSSSSSSS'     'oOOOOOOOOOOOO'  
//
//----------------------------------------------------------------------------------


import "../interfaces/IERC20.sol";
import "../OpenZeppelin/token/ERC20/SafeERC20.sol";
import "../OpenZeppelin/utils/EnumerableSet.sol";
import "../OpenZeppelin/math/SafeMath.sol";
import "../OpenZeppelin/access/Ownable.sol";

import "../Access/MISOAccessControls.sol";
import "../interfaces/IMisoFarm.sol";
import "../Utils/SafeTransfer.sol";


// MasterChef is the master of Rewards. He can make Rewards and he is a fair guy.
//
// Note that its ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once tokens are sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully its bug-free. God bless.
//
// MISO Update - Removed LP migrator
// MISO Update - Removed minter - Contract holds token
// MISO Update - Dev tips parameterised
// MISO Update - Replaced owner with access controls
// MISO Update - Added SafeTransfer

contract MISOMasterChef is IMisoFarm, MISOAccessControls, SafeTransfer {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;


    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accRewardsPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Heres what happens:
        //   1. The pools `accRewardsPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. Users `amount` gets updated.
        //   4. Users `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;             // Address of LP token contract.
        uint256 allocPoint;         // How many allocation points assigned to this pool. tokens to distribute per block.
        uint256 lastRewardBlock;    // Last block number that tokens distribution occurs.
        uint256 accRewardsPerShare; // Accumulated tokens per share, times 1e12. See below.
    }

    // The rewards token
    IERC20 public rewards;
    // Dev address.
    address public devaddr;
    // Percentage amount to be tipped to devs.
    uint256 public devPercentage;
    // Tips owed to develpers.
    uint256 public tips;
    // uint256 public devPaid;
    
    // Block number when bonus tokens period ends.
    uint256 public bonusEndBlock;
    // Reward tokens created per block.
    uint256 public rewardsPerBlock;
    // Bonus muliplier for early rewards makers.
    uint256 public bonusMultiplier;
    // Total rewards debt.
    uint256 public totalRewardDebt;

    // MISOFarmFactory template id
    uint256 public constant override farmTemplate = 1;
    // For initial setup
    bool private initialised;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when rewards mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    function initFarm(
        address _rewards,
        uint256 _rewardsPerBlock,
        uint256 _startBlock,
        address _devaddr,
        address _admin
    ) public {
        require(!initialised);
        rewards = IERC20(_rewards);
        totalAllocPoint = 0;
        rewardsPerBlock = _rewardsPerBlock;
        startBlock = _startBlock;
        devaddr = _devaddr;
        initAccessControls(_admin);
        initialised = true;
    }

    function initFarm(
        bytes calldata _data
    ) public override {
        (address _rewards,
        uint256 _rewardsPerBlock,
        uint256 _startBlock,
        address _devaddr,
        address _admin) = abi.decode(_data, (address, uint256, uint256, address, address));
        initFarm(_rewards,_rewardsPerBlock,_startBlock,_devaddr,_admin );
    }


    /** 
     * @dev Generates init data for Farm Factory
     * @param _rewards Rewards token address
     * @param _rewardsPerBlock - Rewards per block for the whole farm
     * @param _startBlock - Starting block
     * @param _divaddr Any donations if set are sent here
     * @param _accessControls Gives right to access
     */
    function getInitData(
            address _rewards,
            uint256 _rewardsPerBlock,
            uint256 _startBlock,
            address _divaddr,
            address _accessControls
    )
        external
        pure
        returns (bytes memory _data)
    {
        return abi.encode(_rewards, _rewardsPerBlock, _startBlock, _divaddr, _accessControls);
    }


    function setBonus(
        uint256 _bonusEndBlock,
        uint256 _bonusMultiplier
    ) public {
        require(
            hasAdminRole(msg.sender),
            "MasterChef.setBonus: Sender must be admin"
        );

        bonusEndBlock = _bonusEndBlock;
        bonusMultiplier = _bonusMultiplier;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function addToken(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public  {
        require(
            hasAdminRole(msg.sender),
            "MasterChef.addToken: Sender must be admin"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accRewardsPerShare: 0
        }));
    }

    // Update the given pools token allocation point. Can only be called by the operator.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public  {
        require(
            hasOperatorRole(msg.sender) ,
            "MasterChef.set: Sender must be admin"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }


    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        uint256 remaining = blocksRemaining();
        uint multiplier = 0;
        if (remaining == 0) {
            return 0;
        } 
        if (_to <= bonusEndBlock) {
            multiplier = _to.sub(_from).mul(bonusMultiplier);
        } else if (_from >= bonusEndBlock) {
            multiplier = _to.sub(_from);
        } else {
            multiplier = bonusEndBlock.sub(_from).mul(bonusMultiplier).add(
                _to.sub(bonusEndBlock)
            );
        }

        if (multiplier > remaining ) {
            multiplier = remaining;
        }
        return multiplier;
    }

    // View function to see pending tokens on frontend.
    function pendingRewards(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardsPerShare = pool.accRewardsPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 rewardsAccum = multiplier.mul(rewardsPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accRewardsPerShare = accRewardsPerShare.add(rewardsAccum.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accRewardsPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 rewardsAccum = multiplier.mul(rewardsPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        if (devPercentage > 0) {
            tips = tips.add(rewardsAccum.mul(devPercentage).div(1000));
        }
        totalRewardDebt = totalRewardDebt.add(rewardsAccum);
        pool.accRewardsPerShare = pool.accRewardsPerShare.add(rewardsAccum.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for rewards allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accRewardsPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                totalRewardDebt = totalRewardDebt.sub(pending);
                safeRewardsTransfer(msg.sender, pending);
            }
        }
        if(_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accRewardsPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accRewardsPerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {
            totalRewardDebt = totalRewardDebt.sub(pending);
            safeRewardsTransfer(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accRewardsPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe rewards transfer function, just in case if rounding error causes pool to not have enough tokens.
    function safeRewardsTransfer(address _to, uint256 _amount) internal {
        uint256 rewardsBal = rewards.balanceOf(address(this));
        if (_amount > rewardsBal) {
            _safeTransfer(address(rewards), _to, rewardsBal);
        } else {
            _safeTransfer(address(rewards), _to, _amount);
        }
    }

    function tokensRemaining() public view returns(uint256) {
        return rewards.balanceOf(address(this));
    }

    function tokenDebt() public view returns(uint256) {
        return  totalRewardDebt.add(tips);
    }


    // Returns the number of blocks remaining with the current rewards balance
    function blocksRemaining() public view returns (uint256){
        if (tokensRemaining() <= tokenDebt()) {
            return 0;
        }
        uint256 rewardsBal = tokensRemaining().sub(tokenDebt()) ;
        if (rewardsPerBlock > 0) {
            if (devPercentage > 0) {
                rewardsBal = rewardsBal.mul(1000).div(devPercentage.add(1000));
            }
            return rewardsBal / rewardsPerBlock;
        } else {
            return 0;
        }
    }

    // Claims any rewards for the developers, if set
    function claimTips() public {
        require(msg.sender == devaddr, "dev: wut?");
        require(tips > 0, "dev: broke");
        uint256 claimable = tips;
        // devPaid = devPaid.add(claimable);
        tips = 0;
        safeRewardsTransfer(devaddr, claimable);
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }

    // Update dev percentage.
    function setDevPercentage(uint256 _devPercentage) public {
        require(msg.sender == devaddr, "dev: wut?");
        devPercentage = _devPercentage;
    }

    
}