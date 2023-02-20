//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @summary: Vesting contract that serves as an escrow for tokens to be locked (70% of all allocations)
 * @author: Boot Finance
 */

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

/// @title Vesting Contract
/// @dev Any address can vest tokens into this contract with amount, releaseTimestamp, revocable.
///      Anyone can claim tokens (if unlocked as per the schedule).

contract Vesting is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // State variables===================================================================================
    IERC20 public vestingToken;
    address public multiSig;

    // uint256 public maxVestingAmount;
    uint256 public totalVestedAmount;
    uint256 public totalClaimedAmount;
    uint256 private unixYear = 52 * 7 * 24 * 60 * 60;

    struct Timelock {
        uint256 amount;
        uint256 releaseTimestamp;
    }

    mapping(address => Timelock[]) public timelocks;
    mapping(address => uint256) public benClaimed;      //total tokens claimed
    mapping(address => uint256[2]) public benVested;       //total tokens vested
    mapping(address => uint256) public benTotal;        //total locked in contract for user
    mapping(address => uint256) public benVestingIndex;     //index to start the for loop for the user ignoring completely vested timelock

    // map revocability at address level vs individual timelock
    mapping(address => bool[2]) public benRevocable;         // key: beneficiary address, value: revokeTimestamp

    // ===============EVENTS============================================================================================
    event TokenVested(address indexed sender, uint256 amount, uint256 releaseTimestamp, uint256 currentTimestamp);
    event TokenClaimed(address indexed beneficiary, uint256 amount, uint256 currentTimestamp);
    event TokenRevoked(address indexed beneficiary, uint256 amount, uint256 currentTimestamp);
    event Revoke(address indexed account, uint256 currentTimestamp);

    //================CONSTRUCTOR================================================================
    /// @notice Constructor
    /// @param _token ERC20 token
    constructor(
        IERC20 _token,
        address _multiSig
    ) {
        require(address(_token) != address(0) && address(_multiSig) != address(0), "Invalid address");
        vestingToken = _token;
        multiSig = _multiSig;

        totalVestedAmount = 0;
        totalClaimedAmount = 0;
    }
    

    //=================FUNCTIONS=================================================================
    /// @notice Vest function accessed by anyone
    /// @param _beneficiary beneficiary address
    /// @param _amount vesting amount
    /// @param _isRevocable revocable value either 0 or 1
    function vest(address _beneficiary, uint256 _amount, uint256 _isRevocable) external payable whenNotPaused {
        require(_beneficiary != address(0), "Invalid address");
        require( _amount > 0, "amount must be positive");
        // require(totalVestedAmount.add(_amount) <= maxVestingAmount, 'maxVestingAmount is already vested');
        require(_isRevocable == 0 || _isRevocable == 1, "revocable must be 0 or 1");
        uint256 _unlockTimestamp = block.timestamp.add(unixYear);

        Timelock memory newVesting = Timelock(_amount, _unlockTimestamp);
        timelocks[_beneficiary].push(newVesting);

        if(_isRevocable == 0){
            benRevocable[_beneficiary] = [false,false];
        }
        else if(_isRevocable == 1){
            benRevocable[_beneficiary] = [true,false];
        }

        totalVestedAmount = totalVestedAmount.add(_amount);
        benTotal[_beneficiary] = benTotal[_beneficiary].add(_amount);

        // transfer to SC using delegate transfer
        // NOTE: the tokens has to be approved first by the caller to the SC using `approve()` method.
        vestingToken.transferFrom(msg.sender, address(this), _amount);

        emit TokenVested(_beneficiary, _amount, _unlockTimestamp, block.timestamp);
    }

    // ------------------------------------------------------------------------------------------
    /// @notice Revoke vesting
    /// @param _addr beneficiary address

    function revoke(address _addr) public onlyOwner whenNotPaused {
        require(benRevocable[_addr][0] == true && benRevocable[_addr][1] == false, 'Account must be revokable and not already revoked.');

        uint256 amount = _claimableAmount(_addr).sub(benClaimed[_addr]);
        assert(amount <= benTotal[_addr]);
    
        benClaimed[_addr] = benClaimed[_addr].add(amount);
        totalClaimedAmount = totalClaimedAmount.add(amount);

        emit TokenClaimed(_addr, amount, block.timestamp);

        uint256 locked = 0;
        for (uint256 i = 0; i < timelocks[_addr].length; i++) {
            locked = locked.add(timelocks[_addr][i].amount);
        }
        delete timelocks[_addr];

        uint256 bal = locked.sub(benClaimed[_addr]);
        benRevocable[_addr][1] = true;
        emit Revoke(_addr, block.timestamp);
        
        //clean slate
        benClaimed[_addr] = 0;
        benVested[_addr] = [0, 0];
        benTotal[_addr] = 0;
        benVestingIndex[_addr] = 0;
        
        vestingToken.safeTransfer(_addr, amount); //send vested

        if (bal > 0) {
            vestingToken.safeTransfer(multiSig, bal); //send revoked to multisig
            emit TokenRevoked(_addr, bal, block.timestamp);
        }
    }

    // ------------------------------------------------------------------------------------------
    /// @notice Calculate claimable amount for a beneficiary
    /// @param _addr beneficiary address
    function calcClaimableAmount(address _addr) public view returns (uint256) {
        uint256 sum = 0;

        // iterate across all the vestings
        // & check if the releaseTimestamp is elapsed
        // then, add all the amounts as claimable amount
        for (uint256 i = 0; i < timelocks[_addr].length; i++) {
            if (block.timestamp >= timelocks[_addr][i].releaseTimestamp) {
                sum = sum.add(timelocks[_addr][i].amount);
            }
            else {
                uint256 iTimeStamp = timelocks[_addr][i].releaseTimestamp.sub(unixYear);
                uint256 claimable = block.timestamp.sub(iTimeStamp).mul(timelocks[_addr][i].amount).div(unixYear);
                sum = sum.add(claimable);
            }
        }
        return sum;
    }
    
    //Calculate amount claimable by a particular address
    function _claimableAmount(address _addr) private returns (uint256) {
        uint256 completely_vested = 0;
        uint256 partial_sum = 0;
        uint256 inc = 0;

        // iterate across all the vestings
        // & check if the releaseTimestamp is elapsed
        // then, add all the amounts as claimable amount
        for (uint256 i = benVestingIndex[_addr]; i < timelocks[_addr].length; i++) {
            if (block.timestamp >= timelocks[_addr][i].releaseTimestamp) {
                inc += 1;
                completely_vested = completely_vested.add(timelocks[_addr][i].amount);
            }
            else {
                uint256 iTimeStamp = timelocks[_addr][i].releaseTimestamp.sub(unixYear);
                uint256 claimable = block.timestamp.sub(iTimeStamp).mul(timelocks[_addr][i].amount).div(unixYear);
                partial_sum = partial_sum.add(claimable);
            }
        }

        benVestingIndex[_addr] +=inc;
        benVested[_addr][0] = benVested[_addr][0].add(completely_vested);
        benVested[_addr][1] = partial_sum;
        uint256 s = benVested[_addr][0].add(partial_sum);
        assert(s <= benTotal[_addr]);
        return s;
    }

    // ------------------------------------------------------------------------------------------
    /// @notice Claim vesting
    /// Beneficiary can claim claimableAmount which was vested
    function claim() external whenNotPaused nonReentrant {
        require(benRevocable[msg.sender][1] == false, 'Account must not already be revoked.');
        uint256 amount = _claimableAmount(msg.sender).sub(benClaimed[msg.sender]);
        require(amount > 0, "Claimable amount must be positive");
        require(amount <= benTotal[msg.sender], "Cannot withdraw more than total vested amount");

        // transfer from SC
        benClaimed[msg.sender] = benClaimed[msg.sender].add(amount);
        totalClaimedAmount = totalClaimedAmount.add(amount);
        vestingToken.safeTransfer(msg.sender, amount);

        emit TokenClaimed(msg.sender, amount, block.timestamp);
    }

    // ------------------------------------------------------------------------------------------
    /// @notice Pause contract 
    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    /// @notice Unpause contract
    function unpause() public onlyOwner whenPaused {
        _unpause();
    }
}