// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";


/**
 * @title   CrvDepositor
 * @author  ConvexFinance
 * @notice  This is the entry point for CRV > cvxCRV wrapping. It accepts CRV, sends to 'staler'
 *          for depositing into Curves VotingEscrow, and then mints cvxCRV at 1:1 via the 'minter' (cCrv) minus
 *          the lockIncentive (initially 1%) which is used to basically compensate users who call the `lock` function on Curves
 *          system (larger depositors would likely want to lock).
 */
contract CrvDepositor{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable crvBpt;
    address public immutable escrow;
    uint256 private constant MAXTIME = 1 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock crvBpt
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public daoOperator;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveCrv = 0;
    uint256 public unlockTime;

    bool public cooldown;

    /**
     * @param _staker   CVX VoterProxy (0x989AEb4d175e16225E39E87d0D97A3360524AD80)
     * @param _minter   cvxCRV token (0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7)
     * @param _crvBpt   crvBPT for veCRV deposits
     * @param _escrow   CRV VotingEscrow (0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2)
     */
    constructor(
        address _staker,
        address _minter,
        address _crvBpt,
        address _escrow,
        address _daoOperator
    ) public {
        staker = _staker;
        minter = _minter;
        crvBpt = _crvBpt;
        escrow = _escrow;
        feeManager = msg.sender;
        daoOperator = _daoOperator;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function setDaoOperator(address _daoOperator) external {
        require(msg.sender == daoOperator, "!auth");
        daoOperator = _daoOperator;
    }

    function setFees(uint256 _lockIncentive) external{
        require(msg.sender==feeManager, "!auth");

        if(_lockIncentive >= 0 && _lockIncentive <= 30){
            lockIncentive = _lockIncentive;
       }
    }

    function setCooldown(bool _cooldown) external {
      require(msg.sender == daoOperator, "!auth");
      cooldown = _cooldown;
    }

    /**
     * @notice Called once to deposit the balance of CRV in this contract to the VotingEscrow
     */
    function initialLock() external{
        require(!cooldown, "cooldown");
        require(msg.sender==feeManager, "!auth");

        uint256 vecrv = IERC20(escrow).balanceOf(staker);
        if(vecrv == 0){
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;

            //release old lock if exists
            IStaker(staker).release();
            //create new lock
            uint256 crvBalanceStaker = IERC20(crvBpt).balanceOf(staker);
            IStaker(staker).createLock(crvBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    //lock curve
    function _lockCurve() internal {
        if(cooldown) {
          return;
        }

        uint256 crvBalance = IERC20(crvBpt).balanceOf(address(this));
        if(crvBalance > 0){
            IERC20(crvBpt).safeTransfer(staker, crvBalance);
        }
        
        //increase ammount
        uint256 crvBalanceStaker = IERC20(crvBpt).balanceOf(staker);
        if(crvBalanceStaker == 0){
            return;
        }
        
        //increase amount
        IStaker(staker).increaseAmount(crvBalanceStaker);
        

        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;

        //increase time too if over 2 week buffer
        if(unlockInWeeks.sub(unlockTime) > 2){
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    /**
     * @notice Locks the balance of CRV, and gives out an incentive to the caller
     */
    function lockCurve() external {
        require(!cooldown, "cooldown");
        _lockCurve();

        //mint incentives
        if(incentiveCrv > 0){
            ITokenMinter(minter).mint(msg.sender,incentiveCrv);
            incentiveCrv = 0;
        }
    }

    /**
     * @notice Deposit crvBpt for cvxCrv on behalf of another user
     * @dev    See depositFor(address, uint256, bool, address) 
     */
    function deposit(uint256 _amount, bool _lock, address _stakeAddress) public {
        depositFor(msg.sender, _amount, _lock, _stakeAddress);
    }

    /**
     * @notice Deposit crvBpt for cvxCrv
     * @dev    Can locking immediately or defer locking to someone else by paying a fee.
     *         while users can choose to lock or defer, this is mostly in place so that
     *         the cvx reward contract isnt costly to claim rewards.
     * @param _amount        Units of CRV to deposit
     * @param _lock          Lock now? or pay ~1% to the locker
     * @param _stakeAddress  Stake in cvxCrv staking?
     */
    function depositFor(address to, uint256 _amount, bool _lock, address _stakeAddress) public {
        require(_amount > 0,"!>0");
        
        if(_lock){
            //lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(crvBpt).safeTransferFrom(msg.sender, staker, _amount);
            _lockCurve();
            if(incentiveCrv > 0){
                //add the incentive tokens here so they can be staked together
                _amount = _amount.add(incentiveCrv);
                incentiveCrv = 0;
            }
        }else{
            //move tokens here
            IERC20(crvBpt).safeTransferFrom(msg.sender, address(this), _amount);
            //defer lock cost to another user
            uint256 callIncentive = _amount.mul(lockIncentive).div(FEE_DENOMINATOR);
            _amount = _amount.sub(callIncentive);

            //add to a pool for lock caller
            incentiveCrv = incentiveCrv.add(callIncentive);
        }

        bool depositOnly = _stakeAddress == address(0);
        if(depositOnly){
            //mint for to
            ITokenMinter(minter).mint(to,_amount);
        }else{
            //mint here 
            ITokenMinter(minter).mint(address(this),_amount);
            //stake for to
            IERC20(minter).safeApprove(_stakeAddress,0);
            IERC20(minter).safeApprove(_stakeAddress,_amount);
            IRewards(_stakeAddress).stakeFor(to,_amount);
        }
    }

    function deposit(uint256 _amount, bool _lock) external {
        deposit(_amount,_lock,address(0));
    }

    function depositAll(bool _lock, address _stakeAddress) external{
        uint256 crvBal = IERC20(crvBpt).balanceOf(msg.sender);
        deposit(crvBal,_lock,_stakeAddress);
    }
}
