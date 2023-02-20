// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iUTILS.sol";
import "./interfaces/iRESERVE.sol";
import "./interfaces/iDAOVAULT.sol";
import "./interfaces/iROUTER.sol";
import "./interfaces/iBONDVAULT.sol";
import "./interfaces/iBASE.sol"; 
import "./interfaces/iBEP20.sol";
import "./interfaces/iPOOLFACTORY.sol";
import "./interfaces/iSYNTHFACTORY.sol";
import "./interfaces/iSYNTHVAULT.sol";

contract Dao {
    address public DEPLOYER;
    address public BASE;

    uint256 public secondsPerEra;   // Amount of seconds per era (Inherited from BASE contract; intended to be ~1 day)
    uint256 public coolOffPeriod;   // Amount of time a proposal will need to be in finalising stage before it can be finalised
    uint256 public proposalCount;   // Count of proposals
    uint256 public majorityFactor;  // Number used to calculate majority; intended to be 6666bp === 2/3
    uint256 public erasToEarn;      // Amount of eras that make up the targeted RESERVE depletion; regulates incentives
    uint256 public daoClaim;        // The DAOVault's portion of rewards; intended to be ~10% initially
    uint256 public daoFee;          // The SPARTA fee for a user to create a new proposal, intended to be 100 SPARTA initially
    uint256 public currentProposal; // The most recent proposal; should be === proposalCount
    
    struct MemberDetails {
        bool isMember;
        uint weight;
        uint lastBlock;
        uint poolCount;
    }
    struct ProposalDetails {
        uint id;
        string proposalType;
        uint votes;
        uint coolOffTime;
        bool finalising;
        bool finalised;
        uint param;
        address proposedAddress;
        bool open;
        uint startTime;
    }

    bool public daoHasMoved;
    address public DAO;

    iROUTER private _ROUTER;
    iUTILS private _UTILS;
    iBONDVAULT private _BONDVAULT;
    iDAOVAULT private _DAOVAULT;
    iPOOLFACTORY private _POOLFACTORY;
    iSYNTHFACTORY private _SYNTHFACTORY;
    iRESERVE private _RESERVE;
    iSYNTHVAULT private _SYNTHVAULT;

    address[] public arrayMembers;
    address [] listedBondAssets; // Only used in UI; is intended to be a historical array of all past Bond listed assets
    uint256 public bondingPeriodSeconds = 15552000; // Vesting period for bonders (6 months)
    
    mapping(address => bool) public isMember;
    mapping(address => bool) public isListed; // Used internally to get CURRENT listed Bond assets
    mapping(address => uint256) public mapMember_lastTime;

    mapping(uint256 => uint256) public mapPID_param;
    mapping(uint256 => address) public mapPID_address;
    mapping(uint256 => string) public mapPID_type;
    mapping(uint256 => uint256) public mapPID_votes;
    mapping(uint256 => uint256) public mapPID_coolOffTime;
    mapping(uint256 => bool) public mapPID_finalising;
    mapping(uint256 => bool) public mapPID_finalised;
    mapping(uint256 => bool) public mapPID_open;
    mapping(uint256 => uint256) public mapPID_startTime;
    mapping(uint256 => mapping(address => uint256)) public mapPIDMember_votes;

    event MemberDeposits(address indexed member, address indexed pool, uint256 amount);
    event MemberWithdraws(address indexed member, address indexed pool, uint256 balance);

    event NewProposal(address indexed member, uint indexed proposalID, string proposalType);
    event NewVote(address indexed member, uint indexed proposalID, uint voteWeight, uint totalVotes, string proposalType);
    event RemovedVote(address indexed member, uint indexed proposalID, uint voteWeight, uint totalVotes, string proposalType);
    event ProposalFinalising(address indexed member, uint indexed proposalID, uint timeFinalised, string proposalType);
    event CancelProposal(address indexed member, uint indexed proposalID);
    event FinalisedProposal(address indexed member, uint indexed proposalID, uint votesCast, uint totalWeight, string proposalType);
    event ListedAsset(address indexed DAO, address indexed asset);
    event DelistedAsset(address indexed DAO, address indexed asset);
    event DepositAsset(address indexed owner, uint256 depositAmount, uint256 bondedLP);

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == DEPLOYER);
        _;
    }

    constructor (address _base){
        BASE = _base;
        DEPLOYER = msg.sender;
        DAO = address(this);
        coolOffPeriod = 259200;
        erasToEarn = 30;
        majorityFactor = 6666;
        daoClaim = 1000;
        daoFee = 100;
        proposalCount = 0;
        secondsPerEra = iBASE(BASE).secondsPerEra();
    }

    //==================================== PROTOCOL CONTRACTs SETTER =================================//

    function setGenesisAddresses(address _router, address _utils, address _reserve) external onlyDAO {
        _ROUTER = iROUTER(_router);
        _UTILS = iUTILS(_utils);
        _RESERVE = iRESERVE(_reserve);
    }

    function setVaultAddresses(address _daovault, address _bondvault, address _synthVault) external onlyDAO {
        _DAOVAULT = iDAOVAULT(_daovault);
        _BONDVAULT = iBONDVAULT(_bondvault);
        _SYNTHVAULT = iSYNTHVAULT(_synthVault); 
    }
    
    function setFactoryAddresses(address _poolFactory, address _synthFactory) external onlyDAO {
        _POOLFACTORY = iPOOLFACTORY(_poolFactory);
        _SYNTHFACTORY = iSYNTHFACTORY(_synthFactory);
    }

    function setGenesisFactors(uint32 _coolOff, uint32 _daysToEarn, uint32 _majorityFactor, uint32 _daoClaim, uint32 _daoFee) external onlyDAO {
        coolOffPeriod = _coolOff;
        erasToEarn = _daysToEarn;
        majorityFactor = _majorityFactor;
        daoClaim = _daoClaim;
        daoFee = _daoFee;
    }

    // Can purge deployer once DAO is stable and final
    function purgeDeployer() external onlyDAO {
        DEPLOYER = address(0);
    }

    // Can change vesting period for bonders
    function changeBondingPeriod(uint256 bondingSeconds) external onlyDAO{
        bondingPeriodSeconds = bondingSeconds;
    }

    //============================== USER - DEPOSIT/WITHDRAW ================================//

    // User deposits LP tokens in the DAOVault
    function deposit(address pool, uint256 amount) external {
        depositLPForMember(pool, amount, msg.sender);
    }

    // Contract deposits LP tokens for member
    function depositLPForMember(address pool, uint256 amount, address member) public {
        require(_POOLFACTORY.isCuratedPool(pool) == true, "!curated"); // Pool must be Curated
        require(amount > 0, "!amount"); // Deposit amount must be valid
        if (isMember[member] != true) {
            arrayMembers.push(member); // If not a member; add user to member array
            isMember[member] = true; // If not a member; register the user as member
        }
        if((_DAOVAULT.getMemberWeight(member) + _BONDVAULT.getMemberWeight(member)) > 0) {
            harvest(); // If member has existing weight; force harvest to block manipulation of lastTime + harvest
        }
        require(iBEP20(pool).transferFrom(msg.sender, address(_DAOVAULT), amount), "!funds"); // Send user's deposit to the DAOVault
        _DAOVAULT.depositLP(pool, amount, member); // Update user's deposit balance & weight
        mapMember_lastTime[member] = block.timestamp; // Reset user's last harvest time
        emit MemberDeposits(member, pool, amount);
    }
    
    // User withdraws all of their selected asset from the DAOVault
    function withdraw(address pool) external {
        removeVote(); // Users weight is removed from the current open DAO proposal
        require(_DAOVAULT.withdraw(pool, msg.sender), "!transfer"); // User receives their withdrawal
    }

    //============================== REWARDS ================================//
    
    // User claims their DAOVault incentives
    function harvest() public {
        require(_RESERVE.emissions(), "!emissions"); // Reserve must have emissions turned on
        uint reward = calcCurrentReward(msg.sender); // Calculate the user's claimable incentive
        mapMember_lastTime[msg.sender] = block.timestamp; // Reset user's last harvest time
        uint reserve = iBEP20(BASE).balanceOf(address(_RESERVE)); // Get total BASE balance of RESERVE
        uint daoReward = (reserve * daoClaim) / 10000; // Get DAO's share of BASE balance of RESERVE (max user claim amount)
        if(reward > daoReward){
            reward = daoReward; // User cannot claim more than the daoReward limit
        }
        _RESERVE.grantFunds(reward, msg.sender); // Send the claim to the user
    }

    // Calculate the user's current incentive-claim per era
    function calcCurrentReward(address member) public view returns(uint){
        uint secondsSinceClaim = block.timestamp - mapMember_lastTime[member]; // Get seconds passed since last claim
        uint share = calcReward(member); // Get share of rewards for user
        uint reward = (share * secondsSinceClaim) / secondsPerEra; // User's share times eras since they last claimed
        return reward;
    }

    // Calculate the user's current total claimable incentive
    function calcReward(address member) public view returns(uint){
        uint weight = _DAOVAULT.getMemberWeight(member) + _BONDVAULT.getMemberWeight(member); // Get combined total weights (scope: user)
        uint _totalWeight = _DAOVAULT.totalWeight() + _BONDVAULT.totalWeight(); // Get combined total weights (scope: vaults)
        uint reserve = iBEP20(BASE).balanceOf(address(_RESERVE)) / erasToEarn; // Aim to deplete reserve over a number of days
        uint daoReward = (reserve * daoClaim) / 10000; // Get the DAO's share of that
        return _UTILS.calcShare(weight, _totalWeight, daoReward); // Get users's share of that (1 era worth)
    }

    //================================ BOND Feature ==================================//

    // Can burn the SPARTA remaining in this contract (Bond allocations held in the DAO)
    function burnBalance() external onlyDAO returns (bool){
        uint256 baseBal = iBEP20(BASE).balanceOf(address(this));
        iBASE(BASE).burn(baseBal);   
        return true;
    }

    // Can transfer the SPARTA remaining in this contract to a new DAO (If DAO is upgraded)
    function moveBASEBalance(address newDAO) external onlyDAO {
        uint256 baseBal = iBEP20(BASE).balanceOf(address(this));
        iBEP20(BASE).transfer(newDAO, baseBal);
    }

    // List an asset to be enabled for Bonding
    function listBondAsset(address asset) external onlyDAO {
        if(!isListed[asset]){
            isListed[asset] = true; // Register as a currently enabled asset
            listedBondAssets.push(asset); // Add to historical record of past Bond assets
        }
        emit ListedAsset(msg.sender, asset);
    }

    // Delist an asset from the Bond program
    function delistBondAsset(address asset) external onlyDAO {
        isListed[asset] = false; // Unregister as a currently enabled asset
        emit DelistedAsset(msg.sender, asset);
    }

    // User deposits assets to be Bonded
    function bond(address asset, uint256 amount) external payable returns (bool success) {
        require(amount > 0, '!amount'); // Amount must be valid
        require(isListed[asset], '!listed'); // Asset must be listed for Bond
        if (isMember[msg.sender] != true) {
            arrayMembers.push(msg.sender); // If user is not a member; add them to the member array
            isMember[msg.sender] = true; // Register user as a member
        }
        if((_DAOVAULT.getMemberWeight(msg.sender) + _BONDVAULT.getMemberWeight(msg.sender)) > 0) {
            harvest(); // If member has existing weight; force harvest to block manipulation of lastTime + harvest
        }
        uint256 liquidityUnits = handleTransferIn(asset, amount); // Add liquidity and calculate LP units
        _BONDVAULT.depositForMember(asset, msg.sender, liquidityUnits); // Deposit the Bonded LP units in the BondVault
        mapMember_lastTime[msg.sender] = block.timestamp; // Reset user's last harvest time
        emit DepositAsset(msg.sender, amount, liquidityUnits);
        return true;
    }

    // Add Bonded assets as liquidity and calculate LP units
    function handleTransferIn(address _token, uint _amount) internal returns (uint LPunits){
        uint256 spartaAllocation = _UTILS.calcSwapValueInBase(_token, _amount); // Get the SPARTA swap value of the bonded assets
        if(iBEP20(BASE).allowance(address(this), address(_ROUTER)) < spartaAllocation){
            iBEP20(BASE).approve(address(_ROUTER), iBEP20(BASE).totalSupply()); // Increase SPARTA allowance if required
        }
        if(_token == address(0)){
            require((_amount == msg.value), "!amount");
            LPunits = _ROUTER.addLiquidityForMember{value:_amount}(spartaAllocation, _amount, _token, address(_BONDVAULT)); // Add spartaAllocation & BNB as liquidity to mint LP tokens
        } else {
            iBEP20(_token).transferFrom(msg.sender, address(this), _amount); // Transfer user's assets to Dao contract
            if(iBEP20(_token).allowance(address(this), address(_ROUTER)) < _amount){
                uint256 approvalTNK = iBEP20(_token).totalSupply();
                iBEP20(_token).approve(address(_ROUTER), approvalTNK); // Increase allowance if required
            }
            LPunits = _ROUTER.addLiquidityForMember(spartaAllocation, _amount, _token, address(_BONDVAULT)); // Add spartaAllocation & assets as liquidity to mint LP tokens
        } 
    }

    // User claims all of their unlocked Bonded LPs
    function claimAllForMember(address member) external returns (bool){
        address [] memory listedAssets = listedBondAssets; // Get array of bond assets
        for(uint i = 0; i < listedAssets.length; i++){
            uint claimA = calcClaimBondedLP(member, listedAssets[i]); // Check user's unlocked Bonded LPs for each asset
            if(claimA > 0){
               _BONDVAULT.claimForMember(listedAssets[i], member); // Claim LPs if any unlocked
            }
        }
        return true;
    }

    // User claims unlocked Bond units of a selected asset
    function claimForMember(address asset) external returns (bool){
        uint claimA = calcClaimBondedLP(msg.sender, asset); // Check user's unlocked Bonded LPs
        if(claimA > 0){
            _BONDVAULT.claimForMember(asset, msg.sender); // Claim LPs if any unlocked
        }
        return true;
    }
    
    // Calculate user's unlocked Bond units of a selected asset
    function calcClaimBondedLP(address bondedMember, address asset) public returns (uint){
        uint claimAmount = _BONDVAULT.calcBondedLP(bondedMember, asset); // Check user's unlocked Bonded LPs
        return claimAmount;
    }

    //============================== CREATE PROPOSALS ================================//

    // New ID, but specify type, one type for each function call
    // Votes counted to IDs
    // IDs are finalised
    // IDs are executed, but type specifies unique logic

    // New DAO proposal: Simple action
    function newActionProposal(string memory typeStr) external returns(uint) {
        checkProposal(); // If no open proposal; construct new one
        payFee(); // Pay SPARTA fee for new proposal
        mapPID_type[currentProposal] = typeStr; // Set the proposal type
        emit NewProposal(msg.sender, currentProposal, typeStr);
        return currentProposal;
    }

    // New DAO proposal: uint parameter
    function newParamProposal(uint32 param, string memory typeStr) external returns(uint) {
        checkProposal(); // If no open proposal; construct new one
        payFee(); // Pay SPARTA fee for new proposal
        mapPID_param[currentProposal] = param; // Set the proposed parameter
        mapPID_type[currentProposal] = typeStr; // Set the proposal type
        emit NewProposal(msg.sender, currentProposal, typeStr);
        return currentProposal;
    }

    // New DAO proposal: Address parameter
    function newAddressProposal(address proposedAddress, string memory typeStr) external returns(uint) {
        checkProposal(); // If no open proposal; construct new one
        payFee(); // Pay SPARTA fee for new proposal
        mapPID_address[currentProposal] = proposedAddress; // Set the proposed new address
        mapPID_type[currentProposal] = typeStr; // Set the proposal type
        emit NewProposal(msg.sender, currentProposal, typeStr);
        return currentProposal;
    }

    // New DAO proposal: Grant SPARTA to wallet
    function newGrantProposal(address recipient, uint amount) external returns(uint) {
        checkProposal(); // If no open proposal; construct new one
        payFee(); // Pay SPARTA fee for new proposal
        string memory typeStr = "GRANT";
        mapPID_type[currentProposal] = typeStr; // Set the proposal type
        mapPID_address[currentProposal] = recipient; // Set the proposed grant recipient
        mapPID_param[currentProposal] = amount; // Set the proposed grant amount
        emit NewProposal(msg.sender, currentProposal, typeStr);
        return currentProposal;
    }

    // If no existing open DAO proposal; register a new one
    function checkProposal() internal {
        require(mapPID_open[currentProposal] == false, '!open'); // There must not be an existing open proposal
        proposalCount += 1; // Increase proposal count
        currentProposal = proposalCount; // Set current proposal to the new count
        mapPID_open[currentProposal] = true; // Set new proposal as open status
        mapPID_startTime[currentProposal] = block.timestamp; // Set the start time of the proposal to now
    }
    
    // Pay the fee for a new DAO proposal
    function payFee() internal returns(bool){
        uint _amount = daoFee*(10**18); // Convert DAO fee to WEI
        require(iBEP20(BASE).transferFrom(msg.sender, address(_RESERVE), _amount), '!fee'); // User pays the new proposal fee
        return true;
    } 

    //============================== VOTE && FINALISE ================================//

    // Vote for a proposal
    function voteProposal() external returns (uint voteWeight) {
        require(mapPID_open[currentProposal] == true, "!open"); // Proposal must be open status
        bytes memory _type = bytes(mapPID_type[currentProposal]); // Get the proposal type
        voteWeight = countVotes(); // Vote for proposal and recount
        if(hasQuorum(currentProposal) && mapPID_finalising[currentProposal] == false){
            if(isEqual(_type, 'DAO') || isEqual(_type, 'UTILS') || isEqual(_type, 'RESERVE') ||isEqual(_type, 'GET_SPARTA') || isEqual(_type, 'ROUTER') || isEqual(_type, 'LIST_BOND')|| isEqual(_type, 'GRANT')|| isEqual(_type, 'ADD_CURATED_POOL')){
                if(hasMajority(currentProposal)){
                    _finalise(); // Critical proposals require 'majority' consensus to enter finalization phase
                }
            } else {
                _finalise(); // Other proposals require 'quorum' consensus to enter finalization phase
            }
        }
        emit NewVote(msg.sender, currentProposal, voteWeight, mapPID_votes[currentProposal], string(_type));
    }

    // Remove vote from a proposal
    function removeVote() public returns (uint voteWeightRemoved){
        bytes memory _type = bytes(mapPID_type[currentProposal]); // Get the proposal type
        voteWeightRemoved = mapPIDMember_votes[currentProposal][msg.sender]; // Get user's current vote weight
        if(mapPID_open[currentProposal]){
            mapPID_votes[currentProposal] -= voteWeightRemoved; // Remove user's votes from propsal (scope: proposal)
        }
        mapPIDMember_votes[currentProposal][msg.sender] = 0; // Remove user's votes from propsal (scope: member)
        emit RemovedVote(msg.sender, currentProposal, voteWeightRemoved, mapPID_votes[currentProposal], string(_type));
        return voteWeightRemoved;
    }

    // Push the proposal into 'finalising' status
    function _finalise() internal {
        bytes memory _type = bytes(mapPID_type[currentProposal]); // Get the proposal type
        mapPID_finalising[currentProposal] = true; // Set finalising status to true
        mapPID_coolOffTime[currentProposal] = block.timestamp; // Set timestamp to calc cooloff time from
        emit ProposalFinalising(msg.sender, currentProposal, block.timestamp+coolOffPeriod, string(_type));
    }

    // Attempt to cancel the open proposal
    function cancelProposal() external {
        require(block.timestamp > (mapPID_startTime[currentProposal] + 1296000), "!days"); // Proposal must not be new
        mapPID_votes[currentProposal] = 0; // Clear all votes from the proposal
        mapPID_open[currentProposal] = false; // Set the proposal as not open (closed status)
        emit CancelProposal(msg.sender, currentProposal);
    }

    // A finalising-stage proposal can be finalised after the cool off period
    function finaliseProposal() external {
        require((block.timestamp - mapPID_coolOffTime[currentProposal]) > coolOffPeriod, "!cooloff"); // Must be past cooloff period
        require(mapPID_finalising[currentProposal] == true, "!finalising"); // Must be in finalising stage
        if(!hasQuorum(currentProposal)){
            mapPID_finalising[currentProposal] = false; // If proposal has lost quorum consensus; kick it out of the finalising stage
        } else {
            bytes memory _type = bytes(mapPID_type[currentProposal]); // Get the proposal type
            if(isEqual(_type, 'DAO')){
                moveDao(currentProposal);
            } else if (isEqual(_type, 'ROUTER')) {
                moveRouter(currentProposal);
            } else if (isEqual(_type, 'UTILS')){
                moveUtils(currentProposal);
            } else if (isEqual(_type, 'RESERVE')){
                moveReserve(currentProposal);
            } else if (isEqual(_type, 'FLIP_EMISSIONS')){
                flipEmissions(currentProposal);
            } else if (isEqual(_type, 'COOL_OFF')){
                changeCooloff(currentProposal);
            } else if (isEqual(_type, 'ERAS_TO_EARN')){
                changeEras(currentProposal);
            } else if (isEqual(_type, 'GRANT')){
                grantFunds(currentProposal);
            } else if (isEqual(_type, 'GET_SPARTA')){
                _increaseSpartaAllocation(currentProposal);
            } else if (isEqual(_type, 'LIST_BOND')){
                _listBondingAsset(currentProposal);
            } else if (isEqual(_type, 'DELIST_BOND')){
                _delistBondingAsset(currentProposal);
            } else if (isEqual(_type, 'ADD_CURATED_POOL')){
                _addCuratedPool(currentProposal);
            } else if (isEqual(_type, 'REMOVE_CURATED_POOL')){
                _removeCuratedPool(currentProposal);
            } 
        }
    }

    // Change the DAO to a new contract address
    function moveDao(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new address
        require(_proposedAddress != address(0), "!address"); // Proposed address must be valid
        DAO = _proposedAddress; // Change the DAO to point to the new DAO address
        iBASE(BASE).changeDAO(_proposedAddress); // Change the BASE contract to point to the new DAO address
        daoHasMoved = true; // Set status of this old DAO
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Change the ROUTER to a new contract address
    function moveRouter(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new address
        require(_proposedAddress != address(0), "!address"); // Proposed address must be valid
        _ROUTER = iROUTER(_proposedAddress); // Change the DAO to point to the new ROUTER address
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Change the UTILS to a new contract address
    function moveUtils(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new address
        require(_proposedAddress != address(0), "!address"); // Proposed address must be valid
        _UTILS = iUTILS(_proposedAddress); // Change the DAO to point to the new UTILS address
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Change the RESERVE to a new contract address
    function moveReserve(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new address
        require(_proposedAddress != address(0), "!address"); // Proposed address must be valid
        _RESERVE = iRESERVE(_proposedAddress); // Change the DAO to point to the new RESERVE address
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Flip the BASE emissions on/off
    function flipEmissions(uint _proposalID) internal {
        iBASE(BASE).flipEmissions(); // Toggle emissions on the BASE contract
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Change cool off period (Period of time until a finalising proposal can be finalised)
    function changeCooloff(uint _proposalID) internal {
        uint256 _proposedParam = mapPID_param[_proposalID]; // Get the proposed new param
        require(_proposedParam != 0, "!param"); // Proposed param must be valid
        coolOffPeriod = _proposedParam; // Change coolOffPeriod
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Change erasToEarn (Used to regulate the incentives flow)
    function changeEras(uint _proposalID) internal {
        uint256 _proposedParam = mapPID_param[_proposalID]; // Get the proposed new param
        require(_proposedParam != 0, "!param"); // Proposed param must be valid
        erasToEarn = _proposedParam; // Change erasToEarn
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Grant SPARTA to the proposed recipient
    function grantFunds(uint _proposalID) internal {
        uint256 _proposedAmount = mapPID_param[_proposalID]; // Get the proposed SPARTA grant amount
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed SPARTA grant recipient
        require(_proposedAmount != 0, "!param"); // Proposed grant amount must be valid
        require(_proposedAddress != address(0), "!address"); // Proposed recipient must be valid
        _RESERVE.grantFunds(_proposedAmount, _proposedAddress); // Grant the funds to the recipient
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Mint a 2.5M SPARTA allocation for the Bond program
    function _increaseSpartaAllocation(uint _proposalID) internal {
        uint256 _2point5m = 2.5*10**6*10**18; //_2.5m
        iBASE(BASE).mintFromDAO(_2point5m, address(this)); // Mint SPARTA and send to DAO to hold
        completeProposal(_proposalID); // Finalise the proposal
    }

    // List an asset to be enabled for Bonding
    function _listBondingAsset(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new asset
        if(!isListed[_proposedAddress]){
            isListed[_proposedAddress] = true; // Register asset as listed for Bond
            listedBondAssets.push(_proposedAddress); // Add asset to array of listed Bond assets
        }
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Delist an asset from being allowed to Bond
    function _delistBondingAsset(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new asset
        isListed[_proposedAddress] = false; // Unregister asset as listed for Bond (Keep it in the array though; as this is used in the UI)
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Add a pool as 'Curated' to enable synths, weight and incentives
    function _addCuratedPool(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed new asset
        _POOLFACTORY.addCuratedPool(_proposedAddress); // Add the pool as Curated
        completeProposal(_proposalID); // Finalise the proposal
    }

    // Remove a pool from Curated status
    function _removeCuratedPool(uint _proposalID) internal {
        address _proposedAddress = mapPID_address[_proposalID]; // Get the proposed asset for removal
        _POOLFACTORY.removeCuratedPool(_proposedAddress); // Remove pool as Curated
        completeProposal(_proposalID); // Finalise the proposal
    }
    
    // After completing the proposal's action; close it
    function completeProposal(uint _proposalID) internal {
        string memory _typeStr = mapPID_type[_proposalID]; // Get proposal type
        emit FinalisedProposal(msg.sender, _proposalID, mapPID_votes[_proposalID], _DAOVAULT.totalWeight(), _typeStr);
        mapPID_votes[_proposalID] = 0; // Reset proposal votes to 0
        mapPID_finalised[_proposalID] = true; // Finalise the proposal
        mapPID_finalising[_proposalID] = false; // Remove proposal from 'finalising' stage
        mapPID_open[_proposalID] = false; // Close the proposal
    }

    //============================== CONSENSUS ================================//
    
    // Add user's total weight to proposal and recount
    function countVotes() internal returns (uint voteWeight){
        mapPID_votes[currentProposal] -= mapPIDMember_votes[currentProposal][msg.sender]; // Remove user's current votes from the open proposal
        voteWeight = _DAOVAULT.getMemberWeight(msg.sender) + _BONDVAULT.getMemberWeight(msg.sender); // Get user's combined total weights
        mapPID_votes[currentProposal] += voteWeight; // Add user's total weight to the current open proposal (scope: proposal)
        mapPIDMember_votes[currentProposal][msg.sender] = voteWeight; // Add user's total weight to the current open proposal (scope: member)
        return voteWeight;
    }

    // Check if a proposal has Majority consensus
    function hasMajority(uint _proposalID) public view returns(bool){
        uint votes = mapPID_votes[_proposalID]; // Get the proposal's total voting weight
        uint _totalWeight = _DAOVAULT.totalWeight() + _BONDVAULT.totalWeight(); // Get combined total vault weights
        uint consensus = _totalWeight * majorityFactor / 10000; // Majority > 66.6%
        if(votes > consensus){
            return true;
        } else {
            return false;
        }
    }

    // Check if a proposal has Quorum consensus
    function hasQuorum(uint _proposalID) public view returns(bool){
        uint votes = mapPID_votes[_proposalID]; // Get the proposal's total voting weight
        uint _totalWeight = _DAOVAULT.totalWeight()  + _BONDVAULT.totalWeight(); // Get combined total vault weights
        uint consensus = _totalWeight / 2; // Quorum > 50%
        if(votes > consensus){
            return true;
        } else {
            return false;
        }
    }

    // Check if a proposal has Minority consensus
    function hasMinority(uint _proposalID) public view returns(bool){
        uint votes = mapPID_votes[_proposalID]; // Get the proposal's total voting weight
        uint _totalWeight = _DAOVAULT.totalWeight()  + _BONDVAULT.totalWeight(); // Get combined total vault weights
        uint consensus = _totalWeight / 6; // Minority > 16.6%
        if(votes > consensus){
            return true;
        } else {
            return false;
        }
    }

    //======================================PROTOCOL CONTRACTs GETTER=================================//
    
    // Get the ROUTER address that the DAO currently points to
    function ROUTER() public view returns(iROUTER){
        if(daoHasMoved){
            return Dao(DAO).ROUTER();
        } else {
            return _ROUTER;
        }
    }

    // Get the UTILS address that the DAO currently points to
    function UTILS() public view returns(iUTILS){
        if(daoHasMoved){
            return Dao(DAO).UTILS();
        } else {
            return _UTILS;
        }
    }

    // Get the BONDVAULT address that the DAO currently points to
    function BONDVAULT() public view returns(iBONDVAULT){
        if(daoHasMoved){
            return Dao(DAO).BONDVAULT();
        } else {
            return _BONDVAULT;
        }
    }

    // Get the DAOVAULT address that the DAO currently points to
    function DAOVAULT() public view returns(iDAOVAULT){
        if(daoHasMoved){
            return Dao(DAO).DAOVAULT();
        } else {
            return _DAOVAULT;
        }
    }

    // Get the POOLFACTORY address that the DAO currently points to
    function POOLFACTORY() public view returns(iPOOLFACTORY){
        if(daoHasMoved){
            return Dao(DAO).POOLFACTORY();
        } else {
            return _POOLFACTORY;
        }
    }

    // Get the SYNTHFACTORY address that the DAO currently points to
    function SYNTHFACTORY() public view returns(iSYNTHFACTORY){
        if(daoHasMoved){
            return Dao(DAO).SYNTHFACTORY();
        } else {
            return _SYNTHFACTORY;
        }
    }

    // Get the RESERVE address that the DAO currently points to
    function RESERVE() public view returns(iRESERVE){
        if(daoHasMoved){
            return Dao(DAO).RESERVE();
        } else {
            return _RESERVE;
        }
    }

    // Get the SYNTHVAULT address that the DAO currently points to
    function SYNTHVAULT() public view returns(iSYNTHVAULT){
        if(daoHasMoved){
            return Dao(DAO).SYNTHVAULT();
        } else {
            return _SYNTHVAULT;
        }
    }

    //============================== HELPERS ================================//
    
    function memberCount() external view returns(uint){
        return arrayMembers.length;
    }

    function getProposalDetails(uint proposalID) external view returns (ProposalDetails memory proposalDetails){
        proposalDetails.id = proposalID;
        proposalDetails.proposalType = mapPID_type[proposalID];
        proposalDetails.votes = mapPID_votes[proposalID];
        proposalDetails.coolOffTime = mapPID_coolOffTime[proposalID];
        proposalDetails.finalising = mapPID_finalising[proposalID];
        proposalDetails.finalised = mapPID_finalised[proposalID];
        proposalDetails.param = mapPID_param[proposalID];
        proposalDetails.proposedAddress = mapPID_address[proposalID];
        proposalDetails.open = mapPID_open[proposalID];
        proposalDetails.startTime = mapPID_startTime[proposalID];
        return proposalDetails;
    }

    function assetListedCount() external view returns (uint256 count){
        return listedBondAssets.length;
    }

    function allListedAssets() external view returns (address[] memory _allListedAssets){
        return listedBondAssets;
    }
    
    function isEqual(bytes memory part1, bytes memory part2) private pure returns(bool){
        if(sha256(part1) == sha256(part2)){
            return true;
        } else {
            return false;
        }
    }
}


   