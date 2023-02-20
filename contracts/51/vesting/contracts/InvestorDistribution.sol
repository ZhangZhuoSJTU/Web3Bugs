//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @summary: Distribution contract for Angel and Seed Contributors
 * @author: Boot Finance
 */

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "./interfaces/IVesting.sol";

/// @title InvestorDistribution
/// @dev The investor mappings will be initialized after deployment of contract

contract InvestorDistribution is Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //Investor Shares (Angel + Seed Round)
    struct Investors {
        uint256 amount;
        uint256 claimed;
        uint256 total_tokens;
        uint256 fraction;     // with 10**18 precision
    }

    address public admin;
    mapping(address => Investors) public investors;

    uint256 private investors_supply = 11088000 * 10 ** 18;

    // General constants
    uint256 constant HOUR = 3600;
    uint256 constant DAY = 86400;
    uint256 constant WEEK = 86400 * 7;
    uint256 constant YEAR = WEEK * 52;

    //INITIAL_SUPPLY: constant(uint256) = 0
    // INFLATION_DELAY: constant(uint256) = 3 * HOUR # Three Hour delay before minting may begin
    // RATE_DENOMINATOR: constant(uint256) = 10 ** 18
    uint256 constant RATE_TIME = WEEK;                                         // How often the rate goes to the next epoch
    uint256 constant INITIAL_RATE = 135_994 * 10 ** 18 / WEEK;                // 2,474,410 for the first week
    uint256 constant EPOCH_INFLATION = 98_831;                                  // 98.831 % of last week
    uint256 constant INITIAL_RATE_EPOCH_CUTTOF = 260;                          // After 260 Weeks use the late rate

    // Supply variables
    uint256 public miningEpoch;
    uint256 public startEpochTime;
    uint256 public rate;
    uint256 public initTime;

    uint256 public startEpochSupply;
   
    event updateMiningParameters(uint256 time, uint256 rate, uint256 supply);
    event InvestorAdded(address indexed investor, uint256 amount, uint256 timeStamp);
    event InvestorModified(address indexed investor, address newinvestor, uint256 timeStamp);
    event Vested(address indexed investor, uint256 amount, uint256 timeStamp);
    event Rugged(uint256 amount, uint256 timeStamp);
    event AdminChanged(address newAdmin, uint256 timeStamp);

    IERC20 public mainToken;
    IVesting public vestLock;

    // define all the mining calculations here so that it doesn't have to
    // called from MainToken contract
    constructor(IERC20 _mainToken, IVesting _vestLock) {
        require(address(_mainToken) != address(0), "Invalid address");
        require(address(_vestLock) != address(0), "Invalid address");
        mainToken = _mainToken;
        vestLock = _vestLock;
        rate = INITIAL_RATE;
        initTime = block.timestamp;
        startEpochTime = block.timestamp;
        startEpochSupply = 0;
        admin = msg.sender;

        mainToken.approve(address(vestLock), 2**256-1);
    }


    //Address of contributor
    function addInvestor(address _investor, uint256 _amount) external whenNotPaused {
        require(_investor != address(0), "Invalid address");
        require(_amount > 0, "Amount must be positive");
        require(msg.sender == admin, "Unauthorized");

        Investors memory newInvestor = Investors(_amount, 0, _amount, 10**18 * _amount / investors_supply);
        investors[_investor] = newInvestor;

        emit InvestorAdded(_investor, _amount, block.timestamp);
    }

    //Fallback in case a contributor loses keys, or cannot access wallet for any other reason
    function modifyInvestor(address _investor, address _new) external whenNotPaused nonReentrant {
        require(_investor != address(0), "Invalid old address");
        require(_new != address(0), "Invalid new address");
        require(investors[_investor].amount != 0);
        require(msg.sender == admin, "Unauthorized");

        Investors memory newInvestor = Investors(investors[_investor].amount, investors[_investor].claimed, investors[_investor].total_tokens, investors[_investor].fraction);
        investors[_new] = newInvestor;

        Investors memory oldInvestor = Investors(0, 0, 0, 0);
        investors[_investor] = oldInvestor;

        emit InvestorModified(_investor, _new, block.timestamp);
    }

    //Claim function to calculate and withdraw claimable tokens, also lock 70% in vesting contract
    function claim() external nonReentrant {
        require(msg.sender != address(0));
        require(investors[msg.sender].amount != 0);
        
        uint256 avail = _available_supply();
        require(avail > 0, "Nothing claimable (yet?)");

        uint256 claimable = avail * investors[msg.sender].fraction / 10**18;
        assert(claimable > 0);
        if (investors[msg.sender].claimed != 0) {
            claimable -= investors[msg.sender].claimed;
        }

        require(investors[msg.sender].amount - claimable != 0);

        investors[msg.sender].amount -= claimable;
        investors[msg.sender].claimed += claimable;

        uint256 claimable_to_send = claimable * 3 / 10;         //30% released instantly
        mainToken.transfer(msg.sender, claimable_to_send);
        uint256 claimable_not_yet_vested = claimable - claimable_to_send;
        vestLock.vest(msg.sender, claimable_not_yet_vested, 0); //70% locked in vesting contract

        emit Vested(msg.sender, claimable, block.timestamp);
    }

    //Allow users to claim a specific amount instead of the entire amount
    function claimExact(uint256 _value) external nonReentrant {
        require(msg.sender != address(0));
        require(investors[msg.sender].amount != 0);
        
        uint256 avail = _available_supply();
        uint256 claimable = avail * investors[msg.sender].fraction / 10**18;
        if (investors[msg.sender].claimed != 0) {
            claimable -= investors[msg.sender].claimed;
        }

        require(investors[msg.sender].amount >= claimable);
        require(_value <= claimable);
        investors[msg.sender].amount -= _value;
        investors[msg.sender].claimed += _value;

        uint256 claimable_to_send = _value * 3 / 10;
        mainToken.transfer(msg.sender, claimable_to_send);
        uint256 claimable_not_yet_vested = _value - claimable_to_send;
        vestLock.vest(msg.sender, claimable_not_yet_vested, 0);

        emit Vested(msg.sender, _value, block.timestamp);
    }

    /// @notice release of BOOT public sale tokens from this contract 
    /// based on emission rules
    /// updates the rate the mining parameters for public sale tokens
    /// 

    function _updateEmission() private {
        if (block.timestamp >= startEpochTime + RATE_TIME) {
            miningEpoch += 1;
            startEpochTime = startEpochTime.add(RATE_TIME);
            startEpochSupply = startEpochSupply.add(rate.mul(RATE_TIME));

            if (miningEpoch < INITIAL_RATE_EPOCH_CUTTOF) {
                rate = rate.mul(EPOCH_INFLATION).div(100000);
            }
            else {
                rate = 0;
            }
            emit updateMiningParameters(block.timestamp, rate, startEpochSupply);
        }
    }

    //Update emission to be called at every step change to update emission inflation
    function updateEmission() public {
        require(block.timestamp >= startEpochTime + RATE_TIME, "Too soon");
        _updateEmission();
    }

    //Internal function to calculate current available supply
    function _available_supply() private view returns(uint256) {
        assert(block.timestamp - startEpochTime <= RATE_TIME);
        return startEpochSupply + (block.timestamp - startEpochTime) * rate;
    }

    //Public function to calculate current available supply
    function available_supply() public view returns(uint256) {
        assert(block.timestamp - startEpochTime <= RATE_TIME);
        return startEpochSupply + (block.timestamp - startEpochTime) * rate;
    }

    //Dev can access all tokens in the contract after 5 year period, to take care of fringe cases of lost or unclaimed tokens
    function dev_rugpull() public {
        assert(block.timestamp - initTime >= YEAR * 5); //dev can rug the unclaimed tokens 5 years later, assuming someone lost their key, or forgot about it or whatever and figure what to do with them.
        require(msg.sender == admin, "Unauthorized");   //admin-only
        uint256 bal = mainToken.balanceOf(address(this));
        mainToken.transfer(msg.sender, bal);
        emit Rugged(bal, block.timestamp);
    }

    //Change admin of the contract
    function setAdmin(address _newAdmin) public {
        require(msg.sender == admin, "Unauthorized");
        require(address(_newAdmin) != address(0), "Invalid address");
        admin = _newAdmin;
        emit AdminChanged(_newAdmin, block.timestamp);
    }

}