// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


interface IOwner {
    //booster
    function setFactories(address _rfactory, address _sfactory, address _tfactory) external;
    function setArbitrator(address _arb) external;
    function setFeeInfo(address _feeToken, address _feeDistro) external;
    function updateFeeInfo(address _feeToken, bool _active) external;
    function shutdownSystem() external;
    function isShutdown() external view returns(bool);
    function poolLength() external view returns(uint256);
    function poolInfo(uint256) external view returns(address,address,address,address,address,bool);
    function setVoteDelegate(address _voteDelegate) external;
    function setFeeManager(address _feeM) external;
    function setOwner(address _owner) external;

    //rescue
    function setDistribution(address _distributor, address _rewardDeposit, address _treasury) external;
    function setExtraReward(address _token, uint256 _option) external;

    //stash
    function setExtraReward(address _token) external;
    function setRewardHook(address _hook) external;

    //stash factory
    function setImplementation(address _v1, address _v2, address _v3) external;

    //vote extension
    function revertControl() external;
}

/**
 * @title   Booster
 * @author  ConvexFinance
 * @notice  Immutable booster owner that requires all pools to be shutdown before shutting down the entire convex system
 * @dev     A timelock is required if forcing a shutdown if there is a bugged pool that can not be withdrawn from.
 *          Allow arbitrary calls to other contracts, but limit how calls are made to Booster.
 */
contract BoosterOwner{

    address public immutable poolManager;
    address public immutable booster;
    address public immutable stashFactory;
    address public immutable rescueStash;
    address public owner;
    address public pendingowner;
    bool public isSealed;

    uint256 public constant FORCE_DELAY = 30 days;

    bool public isForceTimerStarted;
    uint256 public forceTimestamp;

    event ShutdownStarted(uint256 executableTimestamp);
    event ShutdownExecuted();
    event TransferOwnership(address pendingOwner);
    event AcceptedOwnership(address newOwner);
    event OwnershipSealed();

    /**
     * @param _owner         Owner (e.g. CVX multisig)
     * @param _poolManager   PoolManager (e.g. PoolManagerSecondaryProxy or 0xD20904e5916113D11414F083229e9C8C6F91D1e1)
     * @param _booster       The booster (e.g. 0xF403C135812408BFbE8713b5A23a04b3D48AAE31)
     * @param _stashFactory  Creates stashes (e.g. 0x884da067B66677e72530df91eabb6e3CE69c2bE4)
     * @param _rescueStash   Rescues tokens for subsequent vlCVX redistribution (e.g. 0x01140351069af98416cC08b16424b9E765436531)
     */
    constructor(
        address _owner,
        address _poolManager,
        address _booster,
        address _stashFactory,
        address _rescueStash,
        bool _seal
    ) public {
        owner = _owner;
        poolManager = _poolManager;
        booster = _booster;
        stashFactory = _stashFactory;
        rescueStash = _rescueStash;
        isSealed = _seal;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    function transferOwnership(address _owner) external onlyOwner{
        pendingowner = _owner;
        emit TransferOwnership(_owner);
    }

    function acceptOwnership() external {
        require(pendingowner == msg.sender, "!pendingowner");
        owner = pendingowner;
        pendingowner = address(0);
        emit AcceptedOwnership(owner);
    }

    function sealOwnership() external onlyOwner{
        isSealed = true;
        emit OwnershipSealed();
    }

    function setBoosterOwner() external onlyOwner{
        //allow reverting ownership until sealed
        require(!isSealed, "ownership sealed");

        //transfer booster ownership to this owner
        IOwner(booster).setOwner(owner);
    }

    function setFactories(address _rfactory, address _sfactory, address _tfactory) external onlyOwner{
        IOwner(booster).setFactories(_rfactory, _sfactory, _tfactory);
    }

    function setArbitrator(address _arb) external onlyOwner{
        IOwner(booster).setArbitrator(_arb);
    }

    function setFeeInfo(address _feeToken, address _feeDistro) external onlyOwner{
        IOwner(booster).setFeeInfo(_feeToken, _feeDistro);
    }

    function updateFeeInfo(address _feeToken, bool _active) external onlyOwner{
        IOwner(booster).updateFeeInfo(_feeToken, _active);
    }

    function setFeeManager(address _feeM) external onlyOwner{
        IOwner(booster).setFeeManager(_feeM);
    }

    function setVoteDelegate(address _voteDelegate) external onlyOwner{
        IOwner(booster).setVoteDelegate(_voteDelegate);
    }

    function shutdownSystem() external onlyOwner{
        require(IOwner(poolManager).isShutdown(),"!poolMgrShutdown");

        //check that all pools are already shutdown
        uint256 poolCount = IOwner(booster).poolLength();
        for(uint256 i = 0; i < poolCount; i++){
            (,,,,,bool isshutdown) = IOwner(booster).poolInfo(i);
            require(isshutdown, "!poolShutdown");
        }

        //complete the shutdown process
        IOwner(booster).shutdownSystem();
        emit ShutdownExecuted();
    }


    //queue a forced shutdown that does not require pools to already be shutdown
    //this should only be needed if a pool is broken and withdrawAll() does not
    //correctly return enough lp tokens
    function queueForceShutdown() external onlyOwner{
        require(IOwner(poolManager).isShutdown(),"!poolMgrShutdown");
        require(!isForceTimerStarted, "already started");
    
        isForceTimerStarted = true;
        forceTimestamp = block.timestamp + FORCE_DELAY;

        emit ShutdownStarted(forceTimestamp);
    }

    //force shutdown the system after timer has expired
    function forceShutdownSystem() external onlyOwner{
        require(isForceTimerStarted, "!timer start");
        require(block.timestamp > forceTimestamp, "!timer finish");

        IOwner(booster).shutdownSystem();
        emit ShutdownExecuted();
    }


    //allow arbitrary calls to any contract other than the booster, as some contracts
    //may use ownership as booster.owner() instead of local variable
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {
        require(_to != booster, "!invalid target");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }


    // --- Helper functions for other systems, could also just use execute() ---

    //TokenRescue setDistribution
    function setRescueTokenDistribution(address _distributor, address _rewardDeposit, address _treasury) external onlyOwner{
        IOwner(rescueStash).setDistribution(_distributor, _rewardDeposit, _treasury);
    }

    //TokenRescue setExtraReward
    function setRescueTokenReward(address _token, uint256 _option) external onlyOwner{
        IOwner(rescueStash).setExtraReward(_token, _option);
    }

    //stash v3 - set extra reward
    function setStashExtraReward(address _stash, address _token) external onlyOwner{
        IOwner(_stash).setExtraReward(_token);
    }

    //stash v3 - set reward hook
    function setStashRewardHook(address _stash, address _hook) external onlyOwner{
        IOwner(_stash).setRewardHook(_hook);
    }

    //stash factory - set implementation
    function setStashFactoryImplementation(address _v1, address _v2, address _v3) external onlyOwner{
        IOwner(stashFactory).setImplementation(_v1, _v2, _v3);
    }
}