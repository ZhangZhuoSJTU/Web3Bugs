// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;

import "./ERC20_8.sol";
import "./Interfaces/IWAsset.sol";
import "./SafeERC20.sol";

interface IRewarder {}

interface IMasterChefJoeV2 {
    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. JOEs to distribute per second.
        uint256 lastRewardTimestamp; // Last timestamp that JOEs distribution occurs.
        uint256 accJoePerShare; // Accumulated JOEs per share, times 1e12. See below.
        IRewarder rewarder;
    }

    // Deposit LP tokens to MasterChef for JOE allocation.
    function deposit(uint256 _pid, uint256 _amount) external;

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external;

    // get data on a pool given _pid
    function poolInfo(uint _pid) external view returns (PoolInfo memory pool);

    function poolLength() external returns (uint);
}

// ----------------------------------------------------------------------------
// Wrapped Joe LP token Contract (represents staked JLP token earning JOE Rewards)
// ----------------------------------------------------------------------------
contract WJLP is ERC20_8, IWAsset {
    using SafeERC20 for IERC20;

    IERC20 public immutable JLP;
    IERC20 public immutable JOE;

    IMasterChefJoeV2 public immutable _MasterChefJoe;
    uint public _poolPid;

    address internal activePool;
    address internal TML;
    address internal TMR;
    address internal defaultPool;
    address internal stabilityPool;
    address internal YetiFinanceTreasury;
    address internal borrowerOperations;
    address internal collSurplusPool;

    bool addressesSet;

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 unclaimedJOEReward;
        uint256 amountInYeti;
        //
        // This explanation is from the Master Chef V2 contracts, which we use here to essentially 
        // keep track of rewards which are owned by this contract but actually belong to users 
        // which have wrapped LP tokens. 
        // We do some fancy math here. Basically, any point in time, the amount of JOEs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accJoePerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accJoePerShare` (and `lastRewardTimestamp`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }


    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) userInfo;

    /* ========== INITIALIZER ========== */

    constructor(string memory ERC20_symbol,
        string memory ERC20_name,
        uint8 ERC20_decimals,
        IERC20 _JLP,
        IERC20 _JOE,
        IMasterChefJoeV2 MasterChefJoe,
        uint256 poolPid) {

        checkContract(address(_JLP));
        checkContract(address(_JOE));
        checkContract(address(MasterChefJoe));

        _symbol = ERC20_symbol;
        _name = ERC20_name;
        _decimals = ERC20_decimals;

        JLP = _JLP;
        JOE = _JOE;

        _MasterChefJoe = MasterChefJoe;
        _poolPid = poolPid;
    }

    function setAddresses(
        address _activePool,
        address _TML,
        address _TMR,
        address _defaultPool,
        address _stabilityPool,
        address _YetiFinanceTreasury, 
        address _borrowerOperations, 
        address _collSurplusPool) external {
        require(!addressesSet, "setAddresses: Addresses already set");
        checkContract(_activePool);
        checkContract(_TML);
        checkContract(_TMR);
        checkContract(_defaultPool);
        checkContract(_stabilityPool);
        checkContract(_YetiFinanceTreasury);
        checkContract(_borrowerOperations);
        checkContract(_collSurplusPool);
        activePool = _activePool;
        TML = _TML;
        TMR = _TMR;
        defaultPool = _defaultPool;
        stabilityPool = _stabilityPool;
        YetiFinanceTreasury = _YetiFinanceTreasury;
        borrowerOperations = _borrowerOperations;
        collSurplusPool = _collSurplusPool;
        addressesSet = true;
    }

    /* ========== New Functions =============== */

    // Can be called by anyone.
    // This function pulls in _amount of base JLP tokens from _from, and stakes 
    // them in the reward contract, while updating the reward balance for that user. 
    // Sends reward balance to _rewardRecipient, and the ability to withdraw from the 
    // contract and get your JLP back is tracked by wJLP balance, and given to _to. 
    // If the caller is not borrower operations, then _from and msg.sender must be 
    // the same to make it so you must be the one wrapping your tokens. 
    // Intended for use by Yeti Finance so that users can collateralize their LP tokens 
    // while gaining yield. So the protocol owns wJLP while the user owns the reward balance 
    // and can claim their JOE rewards any time. 
    function wrap(uint _amount, address _from, address _to, address _rewardRecipient) external override {
        if (msg.sender != borrowerOperations) {
            // Unless the caller is borrower operations, msg.sender and _from cannot 
            // be different. 
            require(msg.sender == _from, "WJLP: msg.sender and _from must be the same");
        }

        JLP.transferFrom(_from, address(this), _amount);

        JLP.safeApprove(address(_MasterChefJoe), 0);
        JLP.safeIncreaseAllowance(address(_MasterChefJoe), _amount);

        // stake LP tokens in Trader Joe's.
        // In process of depositing, all this contract's
        // accumulated JOE rewards are sent into this contract
        _MasterChefJoe.deposit(_poolPid, _amount);

        // update user reward tracking
        _userUpdate(_rewardRecipient, _amount, true);
        _mint(_to, _amount);
        if (_to == activePool) {
            userInfo[_rewardRecipient].amountInYeti += _amount;
        }
    }

    // External function intended for users to unwrap manually their LP tokens. 
    function unwrap(uint _amount) external override {
        // Claim pending reward for unwrapper
        _sendJoeReward(msg.sender, msg.sender);

        // Decrease rewards by the same amount user is unwrapping. Ensures they have enough reward balance. 
        _userUpdate(msg.sender, _amount, false);

        // Withdraw LP tokens from Master chef contract
        _MasterChefJoe.withdraw(_poolPid, _amount);
        
        // Rid of WJLP tokens from wallet 
        _burn(msg.sender, _amount);

        // Transfer withdrawn JLP tokens to withdrawer. 
        JLP.safeTransfer(msg.sender, _amount);
    }

    // Override function which allows us to check the amount of LP tokens a user actually has rewards for, and update 
    // that amount so that a user can't keep depositing into the protocol using the same reward amount
    function transferFrom(address _from, address _to, uint _amount) public override returns (bool success) {
        if (msg.sender == borrowerOperations || msg.sender == activePool || msg.sender == defaultPool) {
            UserInfo memory user = userInfo[_from];
            require(user.amount - user.amountInYeti >= _amount, "Reward balance not sufficient to transfer into Yeti Finance");
            user.amountInYeti += _amount;
        }
        return super.transferFrom(_from, _to, _amount);
    }

    // Override function which allows us to check the amount of LP tokens a user actually has rewards for, and update 
    // that amount so that a user can't keep depositing into the protocol using the same reward amount
    function transfer(address _to, uint _amount) public override returns (bool success) {
        if (msg.sender == borrowerOperations || msg.sender == activePool || msg.sender == defaultPool) {
            if (_to != stabilityPool && _to != defaultPool && _to != collSurplusPool){
                UserInfo memory user = userInfo[msg.sender];
                require(user.amount - user.amountInYeti >= _amount, "Reward balance not sufficient to transfer into Yeti Finance");
                user.amountInYeti += _amount;
            }
        }
        return super.transfer(_to, _amount);
    }

    // Only callable by ActivePool or StabilityPool
    // Used to unwrap assets during:
    // 1. Sending 0.5% liquidation reward to liquidators
    // 2. Sending back redeemed assets
    // In both cases, the wrapped asset is first sent to the liquidator or redeemer respectively,
    // then this function is called with _for equal to the the liquidator or redeemer address
    // Prior to this being called, the user whose assets we are burning should have their rewards updated
    // This function also claims rewards when unwrapping so they are automatically sent to the original owner,
    // and also reduces the reward balance before unwrapping is complete. 
    // _from has the current rewards. 
    function unwrapFor(address _from, address _to, uint _amount) external override {
        _requireCallerIsPool();

        // Claim pending reward for original owner
        _sendJoeReward(_from, _from);

        // Decrease rewards by the same amount user is unwrapping. Ensures they have enough reward balance. 
        _userUpdate(_from, _amount, false);
        userInfo[_from].amountInYeti -= _amount;

        // Withdraw LP tokens from Master chef contract
        _MasterChefJoe.withdraw(_poolPid, _amount);

        // msg.sender is either Active Pool or Stability Pool
        // each one has the ability to unwrap and burn WAssets they own and
        // send them to someone else
        _burn(msg.sender, _amount);

        // Transfer withdrawn JLP tokens to new owner. 
        JLP.safeTransfer(_to, _amount);
    }

    // When funds are transferred into the stabilityPool on liquidation,
    // the rewards these funds are earning are allocated Yeti Finance Treasury.
    // But when an stabilityPool depositor wants to withdraw their collateral,
    // the wAsset is unwrapped and the rewards are no longer accruing to the Yeti Finance Treasury
    function endTreasuryReward(address _to, uint _amount) external override {
        _requireCallerIsSPorDP();

        // Then update new owner of rewards.
        _updateReward(YetiFinanceTreasury, _to, _amount);
    }

    // Decreases _from's amount of LP tokens earning yield by _amount
    // And increases _to's amount of LP tokens earning yield by _amount
    // If _to is address(0), then doesn't increase anyone's amount
    function updateReward(address _from, address _to, uint _amount) external override {
        _requireCallerIsLRDorBO();
        _updateReward(_from, _to, _amount);
    }

    function _updateReward(address _from, address _to, uint _amount) internal {
        // Claim any outstanding reward first 
        _sendJoeReward(_from, _from);
        _userUpdate(_from, _amount, false);
        userInfo[_from].amountInYeti -= _amount;
        _userUpdate(_to, _amount, true);
        userInfo[_to].amountInYeti += _amount;
    }

    // checks total pending JOE rewards for _for
    function getPendingRewards(address _for) external view override returns
        (address[] memory, uint[] memory)  {
        // latest accumulated Joe Per Share:
        uint256 accJoePerShare = _MasterChefJoe.poolInfo(_poolPid).accJoePerShare;
        UserInfo storage user = userInfo[_for];

        uint unclaimed = user.unclaimedJOEReward;
        uint pending = (user.amount * accJoePerShare / 1e12) - user.rewardDebt;

        address[] memory tokens = new address[](1);
        uint[] memory amounts = new uint[](1);
        tokens[0] = address(JLP);
        amounts[0] = unclaimed + pending;

        return (tokens, amounts);
    }

    // checks total pending JOE rewards for _for
    function getUserInfo(address _user) external view override returns (uint, uint, uint)  {
        UserInfo memory user = userInfo[_user];
        return (user.amount, user.rewardDebt, user.unclaimedJOEReward);
    }


    // Claims msg.sender's pending rewards and sends to _to address
    function claimReward(address _to) external override {
        _sendJoeReward(msg.sender, _to);
    }


    function _sendJoeReward(address _rewardOwner, address _to) internal {
        // harvests all JOE that the WJLP contract is owed
        _MasterChefJoe.withdraw(_poolPid, 0);

        // updates user.unclaimedJOEReward with latest data from TJ
        _userUpdate(_rewardOwner, 0, true);

        uint joeToSend = userInfo[_rewardOwner].unclaimedJOEReward;
        userInfo[_rewardOwner].unclaimedJOEReward = 0;
        _safeJoeTransfer(_to, joeToSend);
    }

    /*
     * Updates _user's reward tracking to give them unclaimedJOEReward.
     * They have the right to less or more future rewards depending
     * on whether it is or isn't a deposit
    */
    function _userUpdate(address _user, uint256 _amount, bool _isDeposit) private {
        // latest accumulated Joe Per Share:
        uint256 accJoePerShare = _MasterChefJoe.poolInfo(_poolPid).accJoePerShare;
        UserInfo storage user = userInfo[_user];
        uint256 cachedUserAmount = user.amount;

        if (cachedUserAmount != 0) {
            user.unclaimedJOEReward = (cachedUserAmount * accJoePerShare / 1e12) - user.rewardDebt;
        }

        if (_isDeposit) {
            user.amount = cachedUserAmount + _amount;
        } else {
            user.amount = cachedUserAmount - _amount;
        }

        // update for JOE rewards that are already accounted for in user.unclaimedJOEReward
        user.rewardDebt = user.amount * accJoePerShare / 1e12;
    }

    /*
    * Safe joe transfer function, just in case if rounding error causes pool to not have enough JOEs.
    */
    function _safeJoeTransfer(address _to, uint256 _amount) internal {
        IERC20 cachedJOE = JOE;
        uint256 joeBal = cachedJOE.balanceOf(address(this));
        if (_amount > joeBal) {
            cachedJOE.safeTransfer(_to, joeBal);
        } else {
            cachedJOE.safeTransfer(_to, _amount);
        }
    }

    // ===== Check Caller Require View Functions =====

    function _requireCallerIsPool() internal view {
        require((msg.sender == activePool || msg.sender == stabilityPool || msg.sender == collSurplusPool),
            "Caller is not active pool or stability pool"
        );
    }

    function _requireCallerIsSPorDP() internal view {
        require((msg.sender == stabilityPool || msg.sender == defaultPool),
            "Caller is not stability pool or default pool"
        );
    }

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePool,
            "Caller is not active pool"
        );
    }

    // liquidation redemption default pool
    function _requireCallerIsLRDorBO() internal view {
        require(
            (msg.sender == TML ||
             msg.sender == TMR ||
             msg.sender == defaultPool || 
             msg.sender == borrowerOperations),
            "Caller is not LRD"
        );
    }

    function _requireCallerIsSP() internal view {
        require(msg.sender == stabilityPool, "Caller is not stability pool");
    }

    function checkContract(address _account) internal view {
        require(_account != address(0), "Account cannot be zero address");

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(_account) }
        require(size != 0, "Account code size cannot be zero");
    }

}