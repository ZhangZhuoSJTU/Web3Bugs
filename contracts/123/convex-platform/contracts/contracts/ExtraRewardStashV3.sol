// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IRewardHook.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";


/**
 * @title   ExtraRewardStashV3
 * @author  ConvexFinance
 * @notice  ExtraRewardStash for pools added to the Booster to handle extra rewards
 *          that aren't CRV that can be claimed from a gauge.
 *          - v3.0: Support for curve gauge reward redirect
 *            The Booster contract has a function called setGaugeRedirect. This function calls set_rewards_receiver
 *            On the Curve Guage. This tells the Gauge where to send rewards. The Booster crafts the calldata for this
 *            transaction and then calls execute on the VoterProxy which executes this transaction on the Curve Gauge
 *          - v3.1: Support for arbitrary token rewards outside of gauge rewards add 
 *            reward hook to pull rewards during claims
 *          - v3.2: Move constuctor to init function for proxy creation
 */
contract ExtraRewardStashV3 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable crv;
    uint256 private constant maxRewards = 8;

    uint256 public pid;
    address public operator;
    address public staker;
    address public gauge;
    address public rewardFactory;
   
    mapping(address => uint256) public historicalRewards;
    bool public hasRedirected;
    bool public hasCurveRewards;

    struct TokenInfo {
        address token;
        address rewardAddress;
    }

    //use mapping+array so that we dont have to loop check each time setToken is called
    mapping(address => TokenInfo) public tokenInfo;
    address[] public tokenList;

    //address to call for reward pulls
    address public rewardHook;
  
    /**
     * @param _crv CRV token address
     */
    constructor(address _crv) public {
      crv = _crv;
    }

    /**
     * @param _pid        Pool ID
     * @param _operator   Operator (Booster)
     * @param _staker     Staker (VoterProxy)
     * @param _gauge      Gauge
     * @param _rFactory   Reward factory
     */
    function initialize(uint256 _pid, address _operator, address _staker, address _gauge, address _rFactory) external {
        require(gauge == address(0),"!init");
        pid = _pid;
        operator = _operator;
        staker = _staker;
        gauge = _gauge;
        rewardFactory = _rFactory;
    }

    function getName() external pure returns (string memory) {
        return "ExtraRewardStashV3.2";
    }

    function tokenCount() external view returns (uint256){
        return tokenList.length;
    }

    /**
     * @notice  Claim rewards from the gauge
     * @dev     The Stash's claimRewards function calls claimRewards on the Booster contract
     *          which calls claimRewards on the VoterProxy which calls claim_rewards on the gauge
     *          If a RewardHook is set onRewardClaim is also called on that
     *          Called by Booster earmarkRewards
     *          Guage rewards are sent directly to this stash even though the Curve method claim_rewards
     *          is being called by the VoterProxy. This is because Curves guages have the ability to redirect
     *          rewards to somewhere other than msg.sender. This is setup in Booster setGaugeRedirect
     */
    function claimRewards() external returns (bool) {
        require(msg.sender == operator, "!operator");

        //this is updateable from v2 gauges now so must check each time.
        checkForNewRewardTokens();

        //make sure we're redirected
        if(!hasRedirected){
            IDeposit(operator).setGaugeRedirect(pid);
            hasRedirected = true;
        }

        if(hasCurveRewards){
            //claim rewards on gauge for staker
            //using reward_receiver so all rewards will be moved to this stash
            IDeposit(operator).claimRewards(pid,gauge);
        }

        //hook for reward pulls
        if(rewardHook != address(0)){
            try IRewardHook(rewardHook).onRewardClaim(){
            }catch{}
        }
        return true;
    }
   

    //check if gauge rewards have changed
    function checkForNewRewardTokens() internal {
        for(uint256 i = 0; i < maxRewards; i++){
            address token = ICurveGauge(gauge).reward_tokens(i);
            if (token == address(0)) {
                break;
            }
            if(!hasCurveRewards){
                hasCurveRewards = true;
            }
            setToken(token);
        }
    }

    //register an extra reward token to be handled
    // (any new incentive that is not directly on curve gauges)
    function setExtraReward(address _token) external{
        //owner of booster can set extra rewards
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        setToken(_token);
    }

    function setRewardHook(address _hook) external{
        //owner of booster can set reward hook
        require(IDeposit(operator).owner() == msg.sender, "!owner");
        rewardHook = _hook;
    }


    /**
     * @notice  Add a reward token to the token list so it can be claimed
     * @dev     For each token that is added as a claimable reward a VirtualRewardsPool
     *          is deployed to handle virtual distribution of tokens 
     */
    function setToken(address _token) internal {
        TokenInfo storage t = tokenInfo[_token];

        if(t.token == address(0)){
            //set token address
            t.token = _token;

            //check if crv
            if(_token != crv){
                //create new reward contract (for NON-crv tokens only)
                (,,,address mainRewardContract,,) = IDeposit(operator).poolInfo(pid);
                address rewardContract = IRewardFactory(rewardFactory).CreateTokenRewards(
                    _token,
                    mainRewardContract,
                    address(this));
                
                t.rewardAddress = rewardContract;
            }
            //add token to list of known rewards
            tokenList.push(_token);
        }
    }

    //pull assigned tokens from staker to stash
    function stashRewards() external pure returns(bool){

        //after depositing/withdrawing, extra incentive tokens are claimed
        //but from v3 this is default to off, and this stash is the reward receiver too.

        return true;
    }

    /**
     * @notice  Distribute rewards
     * @dev     Send all CRV to the Booster contract and send all extra token
     *          rewards to the rewardContract VirtualRewardsPool
     *          Called by Booster earmarkRewards
     */
    function processStash() external returns(bool){
        require(msg.sender == operator, "!operator");

        uint256 tCount = tokenList.length;
        for(uint i=0; i < tCount; i++){
            TokenInfo storage t = tokenInfo[tokenList[i]];
            address token = t.token;
            if(token == address(0)) continue;
            
            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount > 0) {
                historicalRewards[token] = historicalRewards[token].add(amount);
                if(token == crv){
                    //if crv, send back to booster to distribute
                    IERC20(token).safeTransfer(operator, amount);
                    continue;
                }
            	//add to reward contract
            	address rewards = t.rewardAddress;
            	if(rewards == address(0)) continue;
            	IERC20(token).safeTransfer(rewards, amount);
            	IRewards(rewards).queueNewRewards(amount);
            }
        }
        return true;
    }

}
