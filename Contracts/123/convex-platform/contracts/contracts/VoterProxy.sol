// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";

/**
 * @title   VoterProxy
 * @author  ConvexFinance
 * @notice  VoterProxy whitelisted in the curve SmartWalletWhitelist that
 *          participates in Curve governance. Also handles all deposits since this is 
 *          the address that has the voting power.
 */
contract VoterProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public mintr;
    address public immutable crv;
    address public immutable crvBpt;

    address public immutable escrow;
    address public gaugeController;
    address public rewardDeposit;
    address public withdrawer;

    address public owner;
    address public operator;
    address public depositor;
    
    mapping (address => bool) private stashPool;
    mapping (address => bool) private protectedTokens;
    mapping (bytes32 => bool) private votes;

    bytes4 constant internal EIP1271_MAGIC_VALUE = 0x1626ba7e;

    event VoteSet(bytes32 hash, bool valid);

    /**
     * @param _mintr            CRV minter
     * @param _crv              CRV Token address
     * @param _crvBpt           CRV:ETH 80-20 BPT Token address
     * @param _escrow           Curve Voting escrow contract
     * @param _gaugeController  Curve Gauge Controller
     *                          Controls liquidity gauges and the issuance of coins through the gauges
     */
    constructor(
        address _mintr,
        address _crv,
        address _crvBpt,
        address _escrow,
        address _gaugeController
    ) public {
        mintr = _mintr; 
        crv = _crv;
        crvBpt = _crvBpt;
        escrow = _escrow;
        gaugeController = _gaugeController;
        owner = msg.sender;

        protectedTokens[_crv] = true;
        protectedTokens[_crvBpt] = true;
    }

    function getName() external pure returns (string memory) {
        return "BalancerVoterProxy";
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    /**
     * @notice Allows dao to set the reward withdrawal address
     * @param _withdrawer Whitelisted withdrawer
     * @param _rewardDeposit Distributor address
     */
    function setRewardDeposit(address _withdrawer, address _rewardDeposit) external {
        require(msg.sender == owner, "!auth");
        withdrawer = _withdrawer;
        rewardDeposit = _rewardDeposit;
    }

    /**
     * @notice Allows dao to set the external system config, should it change in the future
     * @param _gaugeController External gauge controller address
     * @param _mintr Token minter address for claiming rewards
     */
    function setSystemConfig(address _gaugeController, address _mintr) external returns (bool) {
        require(msg.sender == owner, "!auth");
        gaugeController = _gaugeController;
        mintr = _mintr;
        return true;
    }

    /**
     * @notice Set the operator of the VoterProxy
     * @param _operator Address of the operator (Booster)
     */
    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(operator == address(0) || IDeposit(operator).isShutdown() == true, "needs shutdown");
        
        operator = _operator;
    }

    /**
     * @notice Set the depositor of the VoterProxy
     * @param _depositor Address of the depositor (CrvDepositor)
     */
    function setDepositor(address _depositor) external {
        require(msg.sender == owner, "!auth");

        depositor = _depositor;
    }

    function setStashAccess(address _stash, bool _status) external returns(bool){
        require(msg.sender == operator, "!auth");
        if(_stash != address(0)){
            stashPool[_stash] = _status;
        }
        return true;
    }

    /**
     * @notice Save a vote hash so when snapshot.org asks this contract if 
     *          a vote signature is valid we are able to check for a valid hash
     *          and return the appropriate response inline with EIP 1721
     * @param _hash  Hash of vote signature that was sent to snapshot.org
     * @param _valid Is the hash valid
     */
    function setVote(bytes32 _hash, bool _valid) external {
        require(msg.sender == operator, "!auth");
        votes[_hash] = _valid;
        emit VoteSet(_hash, _valid);
    }

    /**
     * @notice  Verifies that the hash is valid
     * @dev     Snapshot Hub will call this function when a vote is submitted using
     *          snapshot.js on behalf of this contract. Snapshot Hub will call this
     *          function with the hash and the signature of the vote that was cast.
     * @param _hash Hash of the message that was sent to Snapshot Hub to cast a vote
     * @return EIP1271 magic value if the signature is value 
     */
    function isValidSignature(bytes32 _hash, bytes memory) public view returns (bytes4) {
        if(votes[_hash]) {
            return EIP1271_MAGIC_VALUE;
        } else {
            return 0xffffffff;
        }  
    }

    /**
     * @notice  Deposit tokens into the Curve Gauge
     * @dev     Only can be called by the operator (Booster) once this contract has been
     *          whitelisted by the Curve DAO
     * @param _token  Deposit LP token address
     * @param _gauge  Gauge contract to deposit to 
     */ 
    function deposit(address _token, address _gauge) external returns(bool){
        require(msg.sender == operator, "!auth");
        if(protectedTokens[_token] == false){
            protectedTokens[_token] = true;
        }
        if(protectedTokens[_gauge] == false){
            protectedTokens[_gauge] = true;
        }
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeApprove(_gauge, 0);
            IERC20(_token).safeApprove(_gauge, balance);
            ICurveGauge(_gauge).deposit(balance);
        }
        return true;
    }

    /**
     * @notice  Withdraw ERC20 tokens that have been distributed as extra rewards
     * @dev     Tokens shouldn't end up here if they can help it. However, dao can
     *          set a withdrawer that can process these to some ExtraRewardDistribution.
     */
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(msg.sender == withdrawer, "!auth");
        require(protectedTokens[address(_asset)] == false, "protected");

        balance = _asset.balanceOf(address(this));
        _asset.safeApprove(rewardDeposit, 0);
        _asset.safeApprove(rewardDeposit, balance);
        IRewardDeposit(rewardDeposit).addReward(address(_asset), balance);
        return balance;
    }

    /**
     * @notice  Withdraw LP tokens from a gauge 
     * @dev     Only callable by the operator 
     * @param _token    LP token address
     * @param _gauge    Gauge for this LP token
     * @param _amount   Amount of LP token to withdraw
     */
    function withdraw(address _token, address _gauge, uint256 _amount) public returns(bool){
        require(msg.sender == operator, "!auth");
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_gauge, _amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
        return true;
    }

    /**
     * @notice  Withdraw all LP tokens from a gauge 
     * @dev     Only callable by the operator 
     * @param _token  LP token address
     * @param _gauge  Gauge for this LP token
     */
    function withdrawAll(address _token, address _gauge) external returns(bool){
        require(msg.sender == operator, "!auth");
        uint256 amount = balanceOfPool(_gauge).add(IERC20(_token).balanceOf(address(this)));
        withdraw(_token, _gauge, amount);
        return true;
    }

    function _withdrawSome(address _gauge, uint256 _amount) internal returns (uint256) {
        ICurveGauge(_gauge).withdraw(_amount);
        return _amount;
    }
    
    
    /**
     * @notice  Lock CRV in curves voting escrow contract
     * @dev     Called by the CrvDepositor contract
     * @param _value      Amount of crv to lock
     * @param _unlockTime Timestamp to unlock (max is 4 years)
     */
    function createLock(uint256 _value, uint256 _unlockTime) external returns(bool){
        require(msg.sender == depositor, "!auth");
        IERC20(crvBpt).safeApprove(escrow, 0);
        IERC20(crvBpt).safeApprove(escrow, _value);
        ICurveVoteEscrow(escrow).create_lock(_value, _unlockTime);
        return true;
    }
  
    /**
     * @notice Called by the CrvDepositor to increase amount of locked curve
     */
    function increaseAmount(uint256 _value) external returns(bool){
        require(msg.sender == depositor, "!auth");
        IERC20(crvBpt).safeApprove(escrow, 0);
        IERC20(crvBpt).safeApprove(escrow, _value);
        ICurveVoteEscrow(escrow).increase_amount(_value);
        return true;
    }

    /**
     * @notice Called by the CrvDepositor to increase unlocked time of curve
     * @param _value Timestamp to increase locking to
     */
    function increaseTime(uint256 _value) external returns(bool){
        require(msg.sender == depositor, "!auth");
        ICurveVoteEscrow(escrow).increase_unlock_time(_value);
        return true;
    }

    /**
     * @notice  Withdraw all CRV from Curve's voting escrow contract
     * @dev     Only callable by CrvDepositor and can only withdraw if lock has expired
     */
    function release() external returns(bool){
        require(msg.sender == depositor, "!auth");
        ICurveVoteEscrow(escrow).withdraw();
        return true;
    }

    /**
     * @notice Vote on CRV DAO for proposal
     */
    function vote(uint256 _voteId, address _votingAddress, bool _support) external returns(bool){
        require(msg.sender == operator, "!auth");
        IVoting(_votingAddress).vote(_voteId,_support,false);
        return true;
    }

    /**
     * @notice Vote for a single gauge weight via the controller
     */
    function voteGaugeWeight(address _gauge, uint256 _weight) external returns(bool){
        require(msg.sender == operator, "!auth");

        //vote
        IVoting(gaugeController).vote_for_gauge_weights(_gauge, _weight);
        return true;
    }

    /**
     * @notice  Claim CRV from Curve
     * @dev     Claim CRV for LP token staking from the CRV minter contract
     */
    function claimCrv(address _gauge) external returns (uint256){
        require(msg.sender == operator, "!auth");
        
        uint256 _balance = 0;
        try IMinter(mintr).mint(_gauge){
            _balance = IERC20(crv).balanceOf(address(this));
            IERC20(crv).safeTransfer(operator, _balance);
        }catch{}

        return _balance;
    }

    /**
     * @notice  Claim extra rewards from gauge
     * @dev     Called by operator (Booster) to claim extra rewards 
     */
    function claimRewards(address _gauge) external returns(bool){
        require(msg.sender == operator, "!auth");
        ICurveGauge(_gauge).claim_rewards();
        return true;
    }

    /**
     * @notice  Claim fees (3crv) from staking lp tokens
     * @dev     Only callable by the operator Booster
     * @param _distroContract   Fee distribution contract
     * @param _token            LP token to claim fees for
     */
    function claimFees(address _distroContract, address _token) external returns (uint256){
        require(msg.sender == operator, "!auth");
        IFeeDistributor(_distroContract).claimToken(address(this), _token);
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(operator, _balance);
        return _balance;
    }    

    function balanceOfPool(address _gauge) public view returns (uint256) {
        return ICurveGauge(_gauge).balanceOf(address(this));
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);
        require(success, "!success");

        return (success, result);
    }

}
