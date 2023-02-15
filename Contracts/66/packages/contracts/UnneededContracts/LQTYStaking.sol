 SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "hardhat/console.sol";
import "../Interfaces/IYETIToken.sol";
import "../Interfaces/ISYETI.sol";
import "../Dependencies/LiquityMath.sol";
import "../Interfaces/IYUSDToken.sol";

contract SYETI is ISYETI, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---
    bytes32 constant public NAME = "YETIStaking";

    mapping( address => uint) public stakes;
    uint public totalYETIStaked;

    uint public F_YUSD; // Running sum of YETI fees per-YETI-staked

    // User snapshots of F_YUSD, taken at the point at which their latest deposit was made
    mapping (address => Snapshot) public snapshots;

    struct Snapshot {
        uint F_YUSD_Snapshot;
    }

    IYETIToken public yetiToken;
    IYUSDToken public yusdToken;

    address public troveManagerAddress;
    address public troveManagerRedemptionsAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Events ---

    event YETITokenAddressSet(address _yetiTokenAddress);
    event YUSDTokenAddressSet(address _yusdTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event TroveManagerRedemptionsAddressSet(address _troveManagerRedemptionsAddress);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint YUSDGain);
    event F_YUSDUpdated(uint _F_YUSD);
    event TotalYETIStakedUpdated(uint _totalYETIStaked);
    event EtherSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_YUSD);

    // --- Functions ---

    function setAddresses
    (
        address _yetiTokenAddress,
        address _yusdTokenAddress,
        address _troveManagerAddress,
        address _troveManagerRedemptionsAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
        override
    {
        checkContract(_yetiTokenAddress);
        checkContract(_yusdTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_troveManagerRedemptionsAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        yetiToken = IYETIToken(_yetiTokenAddress);
        yusdToken = IYUSDToken(_yusdTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        troveManagerRedemptionsAddress = _troveManagerRedemptionsAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit YETITokenAddressSet(_yetiTokenAddress);
        emit YETITokenAddressSet(_yusdTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit TroveManagerRedemptionsAddressSet(_troveManagerRedemptionsAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // If caller has a pre-existing stake, send any accumulated YUSD gains to them.
    function stake(uint _YETIamount) external override {
        _requireNonZeroAmount(_YETIamount);

        uint currentStake = stakes[msg.sender];

//        uint ETHGain;
        uint YUSDGain;
        // Grab any accumulated ETH and YUSD gains from the current stake
        if (currentStake != 0) {
//            ETHGain = _getPendingETHGain(msg.sender);
            YUSDGain = _getPendingYUSDGain(msg.sender);
        }

       _updateUserSnapshots(msg.sender);

        uint newStake = currentStake.add(_YETIamount);

        // Increase user’s stake and total YETI staked
        stakes[msg.sender] = newStake;
        totalYETIStaked = totalYETIStaked.add(_YETIamount);
        emit TotalYETIStakedUpdated(totalYETIStaked);

        // Transfer YETI from caller to this contract
        yetiToken.sendToSYETI(msg.sender, _YETIamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, YUSDGain);

         // Send accumulated YUSD gains to the caller
        if (currentStake != 0) {
            yusdToken.transfer(msg.sender, YUSDGain);
//            _sendETHGainToUser(ETHGain);
        }
    }

    // Unstake the YETI and send the it back to the caller, along with their accumulated YUSD gains.
    // If requested amount > stake, send their entire stake.
    function unstake(uint _YETIamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated YUSD gains from the current stake
//        uint ETHGain = _getPendingETHGain(msg.sender);
        uint YUSDGain = _getPendingYUSDGain(msg.sender);

        _updateUserSnapshots(msg.sender);

        if (_YETIamount != 0) {
            uint YETIToWithdraw = LiquityMath._min(_YETIamount, currentStake);

            uint newStake = currentStake.sub(YETIToWithdraw);

            // Decrease user's stake and total YETI staked
            stakes[msg.sender] = newStake;
            totalYETIStaked = totalYETIStaked.sub(YETIToWithdraw);
            emit TotalYETIStakedUpdated(totalYETIStaked);

            // Transfer unstaked YETI to user
            yetiToken.transfer(msg.sender, YETIToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, YUSDGain);

        // Send accumulated YUSD gains to the caller
        yusdToken.transfer(msg.sender, YUSDGain);
//        _sendETHGainToUser(ETHGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

//    function increaseF_ETH(uint _ETHFee) external override {
//        _requireCallerIsTroveManager();
//        uint ETHFeePerYETIStaked;
//
//        if (totalYETIStaked != 0) {ETHFeePerYETIStaked = _ETHFee.mul(DECIMAL_PRECISION).div(totalYETIStaked);}
//
//        F_ETH = F_ETH.add(ETHFeePerYETIStaked);
//        emit F_ETHUpdated(F_ETH);
//    }

    function increaseF_YUSD(uint _YUSDFee) external override {
        _requireCallerIsBOOrTM();
        uint YUSDFeePerYETIStaked;

        if (totalYETIStaked != 0) {YUSDFeePerYETIStaked = _YUSDFee.mul(DECIMAL_PRECISION).div(totalYETIStaked);}

        F_YUSD = F_YUSD.add(YUSDFeePerYETIStaked);
        emit F_YUSDUpdated(F_YUSD);
    }

    // --- Pending reward functions ---

//    function getPendingETHGain(address _user) external view override returns (uint) {
//        return _getPendingETHGain(_user);
//    }
//
//    function _getPendingETHGain(address _user) internal view returns (uint) {
//        uint F_ETH_Snapshot = snapshots[_user].F_ETH_Snapshot;
//        uint ETHGain = stakes[_user].mul(F_ETH.sub(F_ETH_Snapshot)).div(DECIMAL_PRECISION);
//        return ETHGain;
//    }

    function getPendingYUSDGain(address _user) external view override returns (uint) {
        return _getPendingYUSDGain(_user);
    }

    function _getPendingYUSDGain(address _user) internal view returns (uint) {
        uint F_YUSD_Snapshot = snapshots[_user].F_YUSD_Snapshot;
        uint YUSDGain = stakes[_user].mul(F_YUSD.sub(F_YUSD_Snapshot)).div(DECIMAL_PRECISION);
        return YUSDGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
//        snapshots[_user].F_ETH_Snapshot = F_ETH;
        snapshots[_user].F_YUSD_Snapshot = F_YUSD;
        emit StakerSnapshotsUpdated(_user, F_YUSD);
    }

//    function _sendETHGainToUser(uint ETHGain) internal {
//        emit EtherSent(msg.sender, ETHGain);
//        (bool success, ) = msg.sender.call{value: ETHGain}("");
//        require(success, "SYETI: Failed to send accumulated ETHGain");
//    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "SYETI: caller is not TroveM");
    }

    function _requireCallerIsBOOrTM() internal view {
        require(((msg.sender == troveManagerAddress)
        || (msg.sender == borrowerOperationsAddress))
        || (msg.sender == troveManagerRedemptionsAddress),
            "SYETI: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "SYETI: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {
        require(currentStake != 0, 'SYETI: User must have a non-zero stake');
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount != 0, 'SYETI: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
