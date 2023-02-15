// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;

import "./ERC20_8.sol";
import "./Interfaces/IWAsset.sol";


// ----------------------------------------------------------------------------
// Wrapped Joe LP token Contract (represents staked JLP token earning JOE Rewards)
// ----------------------------------------------------------------------------
contract WAAVE is ERC20_8, IWAsset {

    IERC20 public aToken;
    // uint public _poolPid;

    address internal activePool;
    address internal TML;
    address internal TMR;
    address internal defaultPool;
    address internal stabilityPool;
    address internal YetiFinanceTreasury;
    uint public SHAREOFFSET=1e12;
    bool internal addressesSet;

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 interest;
        uint256 snapshotAAVE; // Current AAVE balance: numerator
        uint256 outstandingShares; // Current outstanding shares of QItoken wrapped
        // To calculate a user's reward share we need to know how much of the rewards has been provided when they wrap their aToken.
        // We can calculate the initial rewardAmount per share as rewardAmount / outstandingShares.
        // Upon unwrapping we can calculate the rewards they are entitled to as amount * ((newRewardAmout / newOutstandingShares)-(initialRewardAmount/initialOutstandingShares)).
    }


    // Info of each user that stakes LP tokens.
    mapping(address => UserInfo) userInfo;


    /* ========== INITIALIZER ========== */

    constructor(string memory ERC20_symbol,
        string memory ERC20_name,
        uint8 ERC20_decimals,
        IERC20 _aToken
        ) {

        _symbol = ERC20_symbol;
        _name = ERC20_name;
        _decimals = ERC20_decimals;
        _totalSupply = 0;

        aToken = _aToken;

    }

    function setAddresses(
        address _activePool,
        address _TML,
        address _TMR,
        address _defaultPool,
        address _stabilityPool,
        address _YetiFinanceTreasury) external {
        require(!addressesSet);
        activePool = _activePool;
        TML = _TML;
        TMR = _TMR;
        defaultPool = _defaultPool;
        stabilityPool = _stabilityPool;
        YetiFinanceTreasury = _YetiFinanceTreasury;
        addressesSet = true;
    }

    /* ========== New Functions =============== */


   

    // Can be called by anyone.
    // This function pulls in _amount base tokens from _from, then stakes them in
    // to mint WAssets which it sends to _to. It also updates
    // _rewardOwner's reward tracking such that it now has the right to
    // future yields from the newly minted WAssets
    function wrap(uint _amount, address _from, address _to, address _rewardRecipient) external override {
        
        _mint(_to, 1e18*_amount/aavePerShare());
        aToken.transferFrom(msg.sender, address(this), _amount);
        
    }


    function aavePerShare() public view returns (uint) {
        if (_totalSupply==0) {
            return 1e18;
        }
        return 1e18*aToken.balanceOf(address(this))/_totalSupply;
    }

    function unwrap(uint _amount) external override {
        _burn(msg.sender, _amount);
        aToken.transfer(msg.sender, _amount*aavePerShare()/1e18);
    }


    // Only callable by ActivePool or StabilityPool
    // Used to provide unwrap assets during:
    // 1. Sending 0.5% liquidation reward to liquidators
    // 2. Sending back redeemed assets
    // In both cases, the wrapped asset is first sent to the liquidator or redeemer respectively,
    // then this function is called with _for equal to the the liquidator or redeemer address
    // Prior to this being called, the user whose assets we are burning should have their rewards updated
    function unwrapFor(address _from, address _to, uint _amount) external override {
        _requireCallerIsAPorSP();
        // accumulateRewards(msg.sender);
        // _MasterChefJoe.withdraw(_poolPid, _amount);

        // msg.sender is either Active Pool or Stability Pool
        // each one has the ability to unwrap and burn WAssets they own and
        // send them to someone else
        // userInfo[_to].amount=userInfo[_to].amount-_amount;
        _burn(msg.sender, _amount);
        aToken.transfer(_to, _amount*aavePerShare()/1e18);
    }

    // When funds are transferred into the stabilityPool on liquidation,
    // the rewards these funds are earning are allocated Yeti Finance Treasury.
    // But when an stabilityPool depositor wants to withdraw their collateral,
    // the wAsset is unwrapped and the rewards are no longer accruing to the Yeti Finance Treasury
    function endTreasuryReward(address _to, uint _amount) external override {
        _requireCallerIsSP();
    }

    // Decreases _from's amount of LP tokens earning yield by _amount
    // And increases _to's amount of LP tokens earning yield by _amount
    // If _to is address(0), then doesn't increase anyone's amount
    function updateReward(address _from, address _to, uint _amount) external override {
        _requireCallerIsLRD();

    }

    // // checks total pending JOE rewards for _for
    function getPendingRewards(address _for) external view override returns
        (address[] memory, uint[] memory)  {
            
        address[] memory tokens = new address[](1);
        uint[] memory amounts = new uint[](1);

    
        tokens[0] = address(aToken);
        amounts[0] = balanceOf(_for)*aavePerShare()/1e18;

        return (tokens, amounts);
    }

    // checks total pending JOE rewards for _for
    function getUserInfo(address _user) external view override returns (uint, uint, uint)  {
        UserInfo memory user = userInfo[_user];
        return (balanceOf(_user)*aavePerShare()/1e18, 0, balanceOf(_user));
    }

    function claimRewardTreasury() external {
        require(msg.sender==YetiFinanceTreasury);

    }


    // Claims msg.sender's pending rewards and sends to _to address
    function claimReward(address _to) external override {
        // _sendReward(msg.sender, _to);
    }



  

    // ===== Check Caller Require View Functions =====

    function _requireCallerIsAPorSP() internal view {
        require((msg.sender == activePool || msg.sender == stabilityPool),
            "Caller is not active pool or stability pool"
        );
    }

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePool,
            "Caller is not active pool"
        );
    }

    // liquidation redemption default pool
    function _requireCallerIsLRD() internal view {
        require(
            (msg.sender == TML ||
             msg.sender == TMR ||
             msg.sender == defaultPool),
            "Caller is not LRD"
        );
    }

    function _requireCallerIsSP() internal view {
        require(msg.sender == stabilityPool, "Caller is not stability pool");
    }

}