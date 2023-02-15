// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iBEP20.sol";
import "./interfaces/iDAO.sol";
import "./interfaces/iBASE.sol";
import "./interfaces/iPOOL.sol";
import "./interfaces/iSYNTH.sol";
import "./interfaces/iUTILS.sol";
import "./interfaces/iRESERVE.sol";
import "./interfaces/iSYNTHFACTORY.sol";
import "./interfaces/iPOOLFACTORY.sol";

contract SynthVault {
    address public BASE;
    address public DEPLOYER;

    uint256 public minimumDepositTime;  // Withdrawal & Harvest lockout period; intended to be 1 hour
    uint256 public totalWeight;         // Total weight of the whole SynthVault
    uint256 public erasToEarn;          // Amount of eras that make up the targeted RESERVE depletion; regulates incentives
    uint256 public vaultClaim;          // The SynthVaults's portion of rewards; intended to be ~10% initially
    address [] public stakedSynthAssets; // Array of all synth assets that have ever been staked in (scope: vault)
    uint private lastMonth;             // Timestamp of the start of current metric period (For UI)
    uint public genesis;                // Timestamp from when the synth was first deployed (For UI)

    uint256 public map30DVaultRevenue; // Tally of revenue during current incomplete metric period (for UI)
    uint256 public mapPast30DVaultRevenue; // Tally of revenue from last full metric period (for UI)
    uint256 [] public revenueArray; // Array of the last two metric periods (For UI)

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == _DAO().DAO() || msg.sender == DEPLOYER);
        _;
    }

    constructor(address _base) {
        BASE = _base;
        DEPLOYER = msg.sender;
        erasToEarn = 30;
        minimumDepositTime = 3600; // 1 hour
        vaultClaim = 1000;
        genesis = block.timestamp;
        lastMonth = 0;
    }

    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }

    mapping(address => mapping(address => uint256)) private mapMemberSynth_weight;
    mapping(address => uint256) private mapMemberTotal_weight;
    mapping(address => mapping(address => uint256)) private mapMemberSynth_deposit;

    mapping(address => mapping(address => uint256)) private mapMemberSynth_lastTime;
    mapping(address => uint256) private mapMember_depositTime;
    mapping(address => uint256) public lastBlock;
    mapping(address => bool) private isStakedSynth;
    mapping(address => mapping(address => bool)) private isSynthMember;

    event MemberDeposits(
        address indexed synth,
        address indexed member,
        uint256 newDeposit,
        uint256 weight,
        uint256 totalWeight
    );
    event MemberWithdraws(
        address indexed synth,
        address indexed member,
        uint256 amount,
        uint256 weight,
        uint256 totalWeight
    );
    event MemberHarvests(
        address indexed synth,
        address indexed member,
        uint256 amount,
        uint256 weight,
        uint256 totalWeight
    );

    function setParams(uint256 one, uint256 two, uint256 three) external onlyDAO {
        erasToEarn = one;
        minimumDepositTime = two;
        vaultClaim = three;
    }

    //====================================== DEPOSIT ========================================//

    // User deposits Synths in the SynthVault
    function deposit(address synth, uint256 amount) external {
        depositForMember(synth, msg.sender, amount);
    }

    // Contract deposits Synths in the SynthVault for user
    function depositForMember(address synth, address member, uint256 amount) public {
        require(iSYNTHFACTORY(_DAO().SYNTHFACTORY()).isSynth(synth), "!synth"); // Must be a valid synth
        require(iBEP20(synth).transferFrom(msg.sender, address(this), amount)); // Must successfuly transfer in
        _deposit(synth, member, amount); // Assess and record the deposit
    }

    // Check and record the deposit
    function _deposit(address _synth, address _member, uint256 _amount) internal {
        if(!isStakedSynth[_synth]){
            isStakedSynth[_synth] = true; // Record as a staked synth
            stakedSynthAssets.push(_synth); // Add to staked synth array
        }
        mapMemberSynth_lastTime[_member][_synth] = block.timestamp + minimumDepositTime; // Record deposit time (scope: member -> synth)
        mapMember_depositTime[_member] = block.timestamp + minimumDepositTime; // Record deposit time (scope: member)
        mapMemberSynth_deposit[_member][_synth] += _amount; // Record balance for member
        uint256 _weight = iUTILS(_DAO().UTILS()).calcSpotValueInBase(iSYNTH(_synth).LayerONE(), _amount); // Get the SPARTA weight of the deposit
        mapMemberSynth_weight[_member][_synth] += _weight; // Add the weight to the user (scope: member -> synth)
        mapMemberTotal_weight[_member] += _weight; // Add to the user's total weight (scope: member)
        totalWeight += _weight; // Add to the total weight (scope: vault)
        isSynthMember[_member][_synth] = true; // Record user as a member
        emit MemberDeposits(_synth, _member, _amount, _weight, totalWeight);
    }

    //====================================== HARVEST ========================================//

    // User harvests all of their available rewards
    function harvestAll() external returns (bool) {
        for(uint i = 0; i < stakedSynthAssets.length; i++){
            if((block.timestamp > mapMemberSynth_lastTime[msg.sender][stakedSynthAssets[i]])){
                uint256 reward = calcCurrentReward(stakedSynthAssets[i], msg.sender);
                if(reward > 0){
                    harvestSingle(stakedSynthAssets[i]);
                }
            }
            
        }
        return true;
    }

    // User harvests available rewards of the chosen asset
    function harvestSingle(address synth) public returns (bool) {
        require(iSYNTHFACTORY(_DAO().SYNTHFACTORY()).isSynth(synth), "!synth"); // Must be valid synth
        require(iRESERVE(_DAO().RESERVE()).emissions(), "!emissions"); // RESERVE emissions must be on
        uint256 _weight;
        uint256 reward = calcCurrentReward(synth, msg.sender); // Calc user's current SPARTA reward
        mapMemberSynth_lastTime[msg.sender][synth] = block.timestamp; // Set last harvest time as now
        address _poolOUT = iPOOLFACTORY(_DAO().POOLFACTORY()).getPool(iSYNTH(synth).LayerONE()); // Get pool address
        iRESERVE(_DAO().RESERVE()).grantFunds(reward, _poolOUT); // Send the SPARTA from RESERVE to POOL
        (uint synthReward,) = iPOOL(_poolOUT).mintSynth(synth, address(this)); // Mint synths & tsf to SynthVault
        _weight = iUTILS(_DAO().UTILS()).calcSpotValueInBase(iSYNTH(synth).LayerONE(), synthReward); // Calc reward's SPARTA value
        mapMemberSynth_deposit[msg.sender][synth] += synthReward; // Record deposit for the user (scope: member -> synth)
        mapMemberSynth_weight[msg.sender][synth] += _weight; // Add the weight to the user (scope: member -> synth)
        mapMemberTotal_weight[msg.sender] += _weight; // Add to the user's total weight (scope: member)
        totalWeight += _weight; // Add to the total weight (scope: vault)
        _addVaultMetrics(reward); // Add to the revenue metrics (for UI)
        iSYNTH(synth).realise(_poolOUT); // Check synth-held LP value for premium; burn if so
        emit MemberHarvests(synth, msg.sender, reward, _weight, totalWeight);
        return true;
    }

    // Calculate the user's current incentive-claim per era based on selected asset
    function calcCurrentReward(address synth, address member) public view returns (uint256 reward){
        require((block.timestamp > mapMemberSynth_lastTime[member][synth]), "!unlocked"); // Must not harvest before lockup period passed
        uint256 _secondsSinceClaim = block.timestamp - mapMemberSynth_lastTime[member][synth]; // Get seconds passed since last claim
        uint256 _share = calcReward(synth, member); // Get member's share of RESERVE incentives
        reward = (_share * _secondsSinceClaim) / iBASE(BASE).secondsPerEra(); // User's share times eras since they last claimed
        return reward;
    }

    // Calculate the user's current total claimable incentive
    function calcReward(address synth, address member) public view returns (uint256) {
        uint256 _weight = mapMemberSynth_weight[member][synth]; // Get user's weight (scope: member -> synth)
        uint256 _reserve = reserveBASE() / erasToEarn; // Aim to deplete reserve over a number of days
        uint256 _vaultReward = (_reserve * vaultClaim) / 10000; // Get the SynthVault's share of that
        return iUTILS(_DAO().UTILS()).calcShare(_weight, totalWeight, _vaultReward); // Get member's share of that
    }

    //====================================== WITHDRAW ========================================//

    // User withdraws a percentage of their synths from the vault
    function withdraw(address synth, uint256 basisPoints) external returns (uint256 redeemedAmount) {
        redeemedAmount = _processWithdraw(synth, msg.sender, basisPoints); // Perform the withdrawal
        require(iBEP20(synth).transfer(msg.sender, redeemedAmount)); // Transfer from SynthVault to user
        return redeemedAmount;
    }

    // Contract withdraws a percentage of user's synths from the vault
    function _processWithdraw(address _synth, address _member, uint256 _basisPoints) internal returns (uint256 synthReward) {
        require((block.timestamp > mapMember_depositTime[_member]), "lockout"); // Must not withdraw before lockup period passed
        uint256 _principle = iUTILS(_DAO().UTILS()).calcPart(_basisPoints, mapMemberSynth_deposit[_member][_synth]); // Calc amount to withdraw
        mapMemberSynth_deposit[_member][_synth] -= _principle; // Remove from user's recorded vault holdings
        uint256 _weight = iUTILS(_DAO().UTILS()).calcPart(_basisPoints, mapMemberSynth_weight[_member][_synth]); // Calc SPARTA value of amount
        mapMemberTotal_weight[_member] -= _weight; // Remove from member's total weight (scope: member)
        mapMemberSynth_weight[_member][_synth] -= _weight; // Remove from member's synth weight (scope: member -> synth)
        totalWeight -= _weight; // Remove from total weight (scope: vault)
        emit MemberWithdraws(_synth, _member, synthReward, _weight, totalWeight);
        return (_principle + synthReward);
    }

    //================================ Helper Functions ===============================//

    function reserveBASE() public view returns (uint256) {
        return iBEP20(BASE).balanceOf(_DAO().RESERVE());
    }

    function getMemberDeposit(address synth, address member) external view returns (uint256){
        return mapMemberSynth_deposit[member][synth];
    }

    function getMemberWeight(address member) external view returns (uint256) {
        return mapMemberTotal_weight[member];
    }

    function getStakeSynthLength() external view returns (uint256) {
        return stakedSynthAssets.length;
    }

    function getMemberLastTime(address member) external view returns (uint256) {
        return mapMember_depositTime[member];
    }

    function getMemberLastSynthTime(address synth, address member) external view returns (uint256){
        return mapMemberSynth_lastTime[member][synth];
    }

    function getMemberSynthWeight(address synth, address member) external view returns (uint256) {
        return mapMemberSynth_weight[member][synth];
    }

    //=============================== SynthVault Metrics =================================//

    function _addVaultMetrics(uint256 _fee) internal {
        if(lastMonth == 0){
            lastMonth = block.timestamp;
        }
        if(block.timestamp <= lastMonth + 2592000){ // 30 days
            map30DVaultRevenue = map30DVaultRevenue + _fee;
        } else {
            lastMonth = block.timestamp;
            mapPast30DVaultRevenue = map30DVaultRevenue;
            addRevenue(mapPast30DVaultRevenue);
            map30DVaultRevenue = 0;
            map30DVaultRevenue = map30DVaultRevenue + _fee;
        }
    }

    function addRevenue(uint _totalRev) internal {
        if(!(revenueArray.length == 2)){
            revenueArray.push(_totalRev);
        } else {
            addFee(_totalRev);
        }
    }

    function addFee(uint _rev) internal {
        uint _n = revenueArray.length; // 2
        for (uint i = _n - 1; i > 0; i--) {
            revenueArray[i] = revenueArray[i - 1];
        }
        revenueArray[0] = _rev;
    }
}
