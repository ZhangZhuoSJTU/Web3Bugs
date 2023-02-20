// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";

/**
 * @title   Booster
 * @author  ConvexFinance
 * @notice  Main deposit contract; keeps track of pool info & user deposits; distributes rewards.
 * @dev     They say all paths lead to Rome, and the cvxBooster is no different. This is where it all goes down.
 *          It is responsible for tracking all the pools, it collects rewards from all pools and redirects it.
 */
contract Booster{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable crv;
    address public immutable voteOwnership;
    address public immutable voteParameter;

    uint256 public lockIncentive = 825; //incentive to crv stakers
    uint256 public stakerIncentive = 825; //incentive to native token stakers
    uint256 public earmarkIncentive = 50; //incentive to users who spend gas to make calls
    uint256 public platformFee = 0; //possible fee to build treasury
    uint256 public constant MaxFees = 2500;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public owner;
    address public feeManager;
    address public poolManager;
    address public immutable staker;
    address public immutable minter;
    address public rewardFactory;
    address public stashFactory;
    address public tokenFactory;
    address public rewardArbitrator;
    address public voteDelegate;
    address public treasury;
    address public stakerRewards; //cvx rewards
    address public lockRewards; //cvxCrv rewards(crv)

    mapping(address => FeeDistro) public feeTokens;
    struct FeeDistro {
        address distro;
        address rewards;
        bool active;
    }

    bool public isShutdown;

    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address crvRewards;
        address stash;
        bool shutdown;
    }

    //index(pid) -> pool
    PoolInfo[] public poolInfo;
    mapping(address => bool) public gaugeMap;

    event Deposited(address indexed user, uint256 indexed poolid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolid, uint256 amount);

    event PoolAdded(address lpToken, address gauge, address token, address rewardPool, address stash, uint256 pid);
    event PoolShutdown(uint256 poolId);

    event OwnerUpdated(address newOwner);
    event FeeManagerUpdated(address newFeeManager);
    event PoolManagerUpdated(address newPoolManager);
    event FactoriesUpdated(address rewardFactory, address stashFactory, address tokenFactory);
    event ArbitratorUpdated(address newArbitrator);
    event VoteDelegateUpdated(address newVoteDelegate);
    event RewardContractsUpdated(address lockRewards, address stakerRewards);
    event FeesUpdated(uint256 lockIncentive, uint256 stakerIncentive, uint256 earmarkIncentive, uint256 platformFee);
    event TreasuryUpdated(address newTreasury);
    event FeeInfoUpdated(address feeDistro, address lockFees, address feeToken);
    event FeeInfoChanged(address feeDistro, bool active);

    /**
     * @dev Constructor doing what constructors do. It is noteworthy that
     *      a lot of basic config is set to 0 - expecting subsequent calls to setFeeInfo etc.
     * @param _staker                 VoterProxy (locks the crv and adds to all gauges)
     * @param _minter                 CVX token, or the thing that mints it
     * @param _crv                    CRV
     * @param _voteOwnership          Address of the Curve DAO responsible for ownership stuff
     * @param _voteParameter          Address of the Curve DAO responsible for param updates
     */
    constructor(
        address _staker,
        address _minter,
        address _crv,
        address _voteOwnership,
        address _voteParameter
    ) public {
        staker = _staker;
        minter = _minter;
        crv = _crv;
        voteOwnership = _voteOwnership;
        voteParameter = _voteParameter;
        isShutdown = false;

        owner = msg.sender;
        voteDelegate = msg.sender;
        feeManager = msg.sender;
        poolManager = msg.sender;
        treasury = address(0);

        emit OwnerUpdated(msg.sender);
        emit VoteDelegateUpdated(msg.sender);
        emit FeeManagerUpdated(msg.sender);
        emit PoolManagerUpdated(msg.sender);
    }


    /// SETTER SECTION ///

    /**
     * @notice Owner is responsible for setting initial config, updating vote delegate and shutting system
     */
    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;

        emit OwnerUpdated(_owner);
    }

    /**
     * @notice Fee Manager can update the fees (lockIncentive, stakeIncentive, earmarkIncentive, platformFee)
     */
    function setFeeManager(address _feeM) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeM;

        emit FeeManagerUpdated(_feeM);
    }

    /**
     * @notice Pool manager is responsible for adding new pools
     */
    function setPoolManager(address _poolM) external {
        require(msg.sender == poolManager, "!auth");
        poolManager = _poolM;

        emit PoolManagerUpdated(_poolM);
    }

    /**
     * @notice Factories are used when deploying new pools. Only the stash factory is mutable after init
     */
    function setFactories(address _rfactory, address _sfactory, address _tfactory) external {
        require(msg.sender == owner, "!auth");

        //stash factory should be considered more safe to change
        //updating may be required to handle new types of gauges
        stashFactory = _sfactory;

        //reward factory only allow this to be called once even if owner
        //removes ability to inject malicious staking contracts
        //token factory can also be immutable
        if(rewardFactory == address(0)){
            rewardFactory = _rfactory;
            tokenFactory = _tfactory;

            emit FactoriesUpdated(_rfactory, _sfactory, _tfactory);
        } else {
            emit FactoriesUpdated(address(0), _sfactory, address(0));
        }
    }

    /**
     * @notice Arbitrator handles tokens that are used as secondary rewards across multiple pools
     */
    function setArbitrator(address _arb) external {
        require(msg.sender==owner, "!auth");
        rewardArbitrator = _arb;

        emit ArbitratorUpdated(_arb);
    }

    /**
     * @notice Vote Delegate has the rights to cast votes on the VoterProxy via the Booster
     */
    function setVoteDelegate(address _voteDelegate) external {
        require(msg.sender==voteDelegate, "!auth");
        voteDelegate = _voteDelegate;

        emit VoteDelegateUpdated(_voteDelegate);
    }

    /**
     * @notice Only called once, to set the addresses of cvxCrv (lockRewards) and cvx staking (stakerRewards)
     */
    function setRewardContracts(address _rewards, address _stakerRewards) external {
        require(msg.sender == owner, "!auth");
        
        //reward contracts are immutable or else the owner
        //has a means to redeploy and mint cvx via rewardClaimed()
        if(lockRewards == address(0)){
            lockRewards = _rewards;
            stakerRewards = _stakerRewards;
            emit RewardContractsUpdated(_rewards, _stakerRewards);
        }
    }

    /**
     * @notice Set reward token and claim contract
     * @dev    This creates a secondary (VirtualRewardsPool) rewards contract for the vcxCrv staking contract
     */
    function setFeeInfo(address _feeToken, address _feeDistro) external {
        require(msg.sender == owner, "!auth");
        require(!isShutdown, "shutdown");
        require(lockRewards != address(0) && rewardFactory != address(0), "!initialised");

        require(_feeToken != address(0) && _feeDistro != address(0), "!addresses");
        require(IFeeDistributor(_feeDistro).getTokenTimeCursor(_feeToken) > 0, "!distro");

        if(feeTokens[_feeToken].distro == address(0)){
            require(!gaugeMap[_feeToken], "!token");

            // Distributed directly
            if(_feeToken == crv){
                feeTokens[crv] = FeeDistro({
                    distro: _feeDistro,
                    rewards: lockRewards,
                    active: true
                });
                emit FeeInfoUpdated(_feeDistro, lockRewards, crv);
            } else {
                //create a new reward contract for the new token
                address rewards = IRewardFactory(rewardFactory).CreateTokenRewards(_feeToken, lockRewards, address(this));
                feeTokens[_feeToken] = FeeDistro({
                    distro: _feeDistro,
                    rewards: rewards,
                    active: true
                });
                emit FeeInfoUpdated(_feeDistro, rewards, _feeToken);
            }
        } else {
            feeTokens[_feeToken].distro = _feeDistro;
            emit FeeInfoUpdated(_feeDistro, address(0), _feeToken);
        }
    }

    /**
     * @notice Allows turning off or on for fee distro
     */
    function updateFeeInfo(address _feeToken, bool _active) external {
        require(msg.sender==owner, "!auth");

        require(feeTokens[_feeToken].distro != address(0), "Fee doesn't exist");

        feeTokens[_feeToken].active = _active;

        emit FeeInfoChanged(_feeToken, _active);
    }

    /**
     * @notice Fee manager can set all the relevant fees
     * @param _lockFees     % for cvxCrv stakers where 1% == 100
     * @param _stakerFees   % for CVX stakers where 1% == 100
     * @param _callerFees   % for whoever calls the claim where 1% == 100
     * @param _platform     % for "treasury" or vlCVX where 1% == 100
     */
    function setFees(uint256 _lockFees, uint256 _stakerFees, uint256 _callerFees, uint256 _platform) external{
        require(msg.sender==feeManager, "!auth");

        uint256 total = _lockFees.add(_stakerFees).add(_callerFees).add(_platform);
        require(total <= MaxFees, ">MaxFees");

        require(_lockFees >= 300 && _lockFees <= 1500, "!lockFees");
        require(_stakerFees >= 300 && _stakerFees <= 1500, "!stakerFees");
        require(_callerFees >= 10 && _callerFees <= 100, "!callerFees");
        require(_platform <= 200, "!platform");

        lockIncentive = _lockFees;
        stakerIncentive = _stakerFees;
        earmarkIncentive = _callerFees;
        platformFee = _platform;

        emit FeesUpdated(_lockFees, _stakerFees, _callerFees, _platform);
    }

    /**
     * @notice Set the address of the treasury (i.e. vlCVX)
     */
    function setTreasury(address _treasury) external {
        require(msg.sender==feeManager, "!auth");
        treasury = _treasury;

        emit TreasuryUpdated(_treasury);
    }

    /// END SETTER SECTION ///


    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @notice Called by the PoolManager (i.e. PoolManagerProxy) to add a new pool - creates all the required
     *         contracts (DepositToken, RewardPool, Stash) and then adds to the list!
     */
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external returns(bool){
        require(msg.sender==poolManager && !isShutdown, "!add");
        require(_gauge != address(0) && _lptoken != address(0),"!param");
        require(feeTokens[_gauge].distro == address(0), "!gauge");

        //the next pool's pid
        uint256 pid = poolInfo.length;

        //create a tokenized deposit
        address token = ITokenFactory(tokenFactory).CreateDepositToken(_lptoken);
        //create a reward contract for crv rewards
        address newRewardPool = IRewardFactory(rewardFactory).CreateCrvRewards(pid,token,_lptoken);
        //create a stash to handle extra incentives
        address stash = IStashFactory(stashFactory).CreateStash(pid,_gauge,staker,_stashVersion);

        //add the new pool
        poolInfo.push(
            PoolInfo({
                lptoken: _lptoken,
                token: token,
                gauge: _gauge,
                crvRewards: newRewardPool,
                stash: stash,
                shutdown: false
            })
        );
        gaugeMap[_gauge] = true;
        //give stashes access to rewardfactory and voteproxy
        //   voteproxy so it can grab the incentive tokens off the contract after claiming rewards
        //   reward factory so that stashes can make new extra reward contracts if a new incentive is added to the gauge
        if(stash != address(0)){
            poolInfo[pid].stash = stash;
            IStaker(staker).setStashAccess(stash,true);
            IRewardFactory(rewardFactory).setAccess(stash,true);
        }

        emit PoolAdded(_lptoken, _gauge, token, newRewardPool, stash, pid);
        return true;
    }

    /**
     * @notice Shuts down the pool by withdrawing everything from the gauge to here (can later be
     *         claimed from depositors by using the withdraw fn) and marking it as shut down
     */
    function shutdownPool(uint256 _pid) external returns(bool){
        require(msg.sender==poolManager, "!auth");
        PoolInfo storage pool = poolInfo[_pid];

        //withdraw from gauge
        try IStaker(staker).withdrawAll(pool.lptoken,pool.gauge){
        }catch{}

        pool.shutdown = true;
        gaugeMap[pool.gauge] = false;

        emit PoolShutdown(_pid);
        return true;
    }

    /**
     * @notice Shuts down the WHOLE SYSTEM by withdrawing all the LP tokens ot here and then allowing
     *         for subsequent withdrawal by any depositors.
     */
    function shutdownSystem() external{
        require(msg.sender == owner, "!auth");
        isShutdown = true;

        for(uint i=0; i < poolInfo.length; i++){
            PoolInfo storage pool = poolInfo[i];
            if (pool.shutdown) continue;

            address token = pool.lptoken;
            address gauge = pool.gauge;

            //withdraw from gauge
            try IStaker(staker).withdrawAll(token,gauge){
                pool.shutdown = true;
            }catch{}
        }
    }

    /**
     * @notice  Deposits an "_amount" to a given gauge (specified by _pid), mints a `DepositToken`
     *          and subsequently stakes that on Convex BaseRewardPool
     */
    function deposit(uint256 _pid, uint256 _amount, bool _stake) public returns(bool){
        require(!isShutdown,"shutdown");
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        //send to proxy to stake
        address lptoken = pool.lptoken;
        IERC20(lptoken).safeTransferFrom(msg.sender, staker, _amount);

        //stake
        address gauge = pool.gauge;
        require(gauge != address(0),"!gauge setting");
        IStaker(staker).deposit(lptoken,gauge);

        //some gauges claim rewards when depositing, stash them in a seperate contract until next claim
        address stash = pool.stash;
        if(stash != address(0)){
            IStash(stash).stashRewards();
        }

        address token = pool.token;
        if(_stake){
            //mint here and send to rewards on user behalf
            ITokenMinter(token).mint(address(this),_amount);
            address rewardContract = pool.crvRewards;
            IERC20(token).safeApprove(rewardContract,0);
            IERC20(token).safeApprove(rewardContract,_amount);
            IRewards(rewardContract).stakeFor(msg.sender,_amount);
        }else{
            //add user balance directly
            ITokenMinter(token).mint(msg.sender,_amount);
        }

        
        emit Deposited(msg.sender, _pid, _amount);
        return true;
    }

    /**
     * @notice  Deposits all a senders balance to a given gauge (specified by _pid), mints a `DepositToken`
     *          and subsequently stakes that on Convex BaseRewardPool
     */
    function depositAll(uint256 _pid, bool _stake) external returns(bool){
        address lptoken = poolInfo[_pid].lptoken;
        uint256 balance = IERC20(lptoken).balanceOf(msg.sender);
        deposit(_pid,balance,_stake);
        return true;
    }

    /**
     * @notice  Withdraws LP tokens from a given PID (& user).
     *          1. Burn the cvxLP balance from "_from" (implicit balance check)
     *          2. If pool !shutdown.. withdraw from gauge
     *          3. If stash, stash rewards
     *          4. Transfer out the LP tokens
     */
    function _withdraw(uint256 _pid, uint256 _amount, address _from, address _to) internal {
        PoolInfo storage pool = poolInfo[_pid];
        address lptoken = pool.lptoken;
        address gauge = pool.gauge;

        //remove lp balance
        address token = pool.token;
        ITokenMinter(token).burn(_from,_amount);

        //pull from gauge if not shutdown
        // if shutdown tokens will be in this contract
        if (!pool.shutdown) {
            IStaker(staker).withdraw(lptoken,gauge, _amount);
        }

        //some gauges claim rewards when withdrawing, stash them in a seperate contract until next claim
        //do not call if shutdown since stashes wont have access
        address stash = pool.stash;
        if(stash != address(0) && !isShutdown && !pool.shutdown){
            IStash(stash).stashRewards();
        }
        
        //return lp tokens
        IERC20(lptoken).safeTransfer(_to, _amount);

        emit Withdrawn(_to, _pid, _amount);
    }

    /**
     * @notice  Withdraw a given amount from a pool (must already been unstaked from the Convex Reward Pool -
     *          BaseRewardPool uses withdrawAndUnwrap to get around this)
     */
    function withdraw(uint256 _pid, uint256 _amount) public returns(bool){
        _withdraw(_pid,_amount,msg.sender,msg.sender);
        return true;
    }

    /**
     * @notice  Withdraw all the senders LP tokens from a given gauge
     */
    function withdrawAll(uint256 _pid) public returns(bool){
        address token = poolInfo[_pid].token;
        uint256 userBal = IERC20(token).balanceOf(msg.sender);
        withdraw(_pid, userBal);
        return true;
    }

    /**
     * @notice Allows the actual BaseRewardPool to withdraw and send directly to the user
     */
    function withdrawTo(uint256 _pid, uint256 _amount, address _to) external returns(bool){
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == rewardContract,"!auth");

        _withdraw(_pid,_amount,msg.sender,_to);
        return true;
    }

    /**
     * @notice set valid vote hash on VoterProxy 
     */
    function setVote(bytes32 _hash, bool valid) external returns(bool){
        require(msg.sender == voteDelegate, "!auth");
        
        IStaker(staker).setVote(_hash, valid);
        return true;
    }

    /**
     * @notice Delegate address votes on dao via VoterProxy
     */
    function vote(uint256 _voteId, address _votingAddress, bool _support) external returns(bool){
        require(msg.sender == voteDelegate, "!auth");
        require(_votingAddress == voteOwnership || _votingAddress == voteParameter, "!voteAddr");
        
        IStaker(staker).vote(_voteId,_votingAddress,_support);
        return true;
    }

    /**
     * @notice Delegate address votes on gauge weight via VoterProxy
     */
    function voteGaugeWeight(address[] calldata _gauge, uint256[] calldata _weight ) external returns(bool){
        require(msg.sender == voteDelegate, "!auth");

        for(uint256 i = 0; i < _gauge.length; i++){
            IStaker(staker).voteGaugeWeight(_gauge[i],_weight[i]);
        }
        return true;
    }

    /**
     * @notice Allows a stash to claim secondary rewards from a gauge
     */
    function claimRewards(uint256 _pid, address _gauge) external returns(bool){
        address stash = poolInfo[_pid].stash;
        require(msg.sender == stash,"!auth");

        IStaker(staker).claimRewards(_gauge);
        return true;
    }

    /**
     * @notice Tells the Curve gauge to redirect any accrued rewards to the given stash via the VoterProxy
     */
    function setGaugeRedirect(uint256 _pid) external returns(bool){
        address stash = poolInfo[_pid].stash;
        require(msg.sender == stash,"!auth");
        address gauge = poolInfo[_pid].gauge;
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("set_rewards_receiver(address)")), stash);
        IStaker(staker).execute(gauge,uint256(0),data);
        return true;
    }

    /**
     * @notice Basically a hugely pivotal function.
     *         Repsonsible for collecting the crv from gauge, and then redistributing to the correct place.
     *         Pays the caller a fee to process this.
     */
    function _earmarkRewards(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        require(pool.shutdown == false, "pool is closed");

        address gauge = pool.gauge;

        //claim crv
        IStaker(staker).claimCrv(gauge);

        //check if there are extra rewards
        address stash = pool.stash;
        if(stash != address(0)){
            //claim extra rewards
            IStash(stash).claimRewards();
            //process extra rewards
            IStash(stash).processStash();
        }

        //crv balance
        uint256 crvBal = IERC20(crv).balanceOf(address(this));

        if (crvBal > 0) {
            // LockIncentive = cvxCrv stakers (currently 10%)
            uint256 _lockIncentive = crvBal.mul(lockIncentive).div(FEE_DENOMINATOR);
            // StakerIncentive = cvx stakers (currently 5%)
            uint256 _stakerIncentive = crvBal.mul(stakerIncentive).div(FEE_DENOMINATOR);
            // CallIncentive = caller of this contract (currently 1%)
            uint256 _callIncentive = crvBal.mul(earmarkIncentive).div(FEE_DENOMINATOR);
            
            // Treasury = vlCVX (currently 1%)
            if(treasury != address(0) && treasury != address(this) && platformFee > 0){
                //only subtract after address condition check
                uint256 _platform = crvBal.mul(platformFee).div(FEE_DENOMINATOR);
                crvBal = crvBal.sub(_platform);
                IERC20(crv).safeTransfer(treasury, _platform);
            }

            //remove incentives from balance
            crvBal = crvBal.sub(_lockIncentive).sub(_callIncentive).sub(_stakerIncentive);

            //send incentives for calling
            IERC20(crv).safeTransfer(msg.sender, _callIncentive);          

            //send crv to lp provider reward contract
            address rewardContract = pool.crvRewards;
            IERC20(crv).safeTransfer(rewardContract, crvBal);
            IRewards(rewardContract).queueNewRewards(crvBal);

            //send lockers' share of crv to reward contract
            IERC20(crv).safeTransfer(lockRewards, _lockIncentive);
            IRewards(lockRewards).queueNewRewards(_lockIncentive);

            //send stakers's share of crv to reward contract
            IERC20(crv).safeTransfer(stakerRewards, _stakerIncentive);
        }
    }

    /**
     * @notice Basically a hugely pivotal function.
     *         Repsonsible for collecting the crv from gauge, and then redistributing to the correct place.
     *         Pays the caller a fee to process this.
     */
    function earmarkRewards(uint256 _pid) external returns(bool){
        require(!isShutdown,"shutdown");
        _earmarkRewards(_pid);
        return true;
    }

    /**
     * @notice Claim fees from curve distro contract, put in lockers' reward contract.
     *         lockFees is the secondary reward contract that uses the virtual balances from cvxCrv
     */
    function earmarkFees(address _feeToken) external returns(bool){
        require(!isShutdown,"shutdown");
        FeeDistro memory feeDistro = feeTokens[_feeToken];
        
        require(feeDistro.active, "Inactive distro");
        require(!gaugeMap[_feeToken], "Invalid token");

        //claim fee rewards
        uint256 tokenBalanceBefore = IERC20(_feeToken).balanceOf(address(this));
        IStaker(staker).claimFees(feeDistro.distro, _feeToken);
        uint256 tokenBalanceAfter = IERC20(_feeToken).balanceOf(address(this));
        uint256 feesClaimed = tokenBalanceAfter.sub(tokenBalanceBefore);

        //send fee rewards to reward contract
        IERC20(_feeToken).safeTransfer(feeDistro.rewards, feesClaimed);
        IRewards(feeDistro.rewards).queueNewRewards(feesClaimed);

        return true;
    }

    /**
     * @notice Callback from reward contract when crv is received.
     * @dev    Goes off and mints a relative amount of `CVX` based on the distribution schedule.
     */
    function rewardClaimed(uint256 _pid, address _address, uint256 _amount) external returns(bool){
        address rewardContract = poolInfo[_pid].crvRewards;
        require(msg.sender == rewardContract || msg.sender == lockRewards, "!auth");

        //mint reward tokens
        ITokenMinter(minter).mint(_address,_amount);
        
        return true;
    }

}
