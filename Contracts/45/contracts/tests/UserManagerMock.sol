//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title UserManager Contract
 * @dev Manages the Union members credit lines, and their vouchees and borrowers info.
 */
contract UserManagerMock {
    uint256 public constant MAX_TRUST_LIMIT = 100;
    uint256 public constant MAX_STAKE_AMOUNT = 1000e18;

    uint256 public newMemberFee; // New member application fee
    uint256 public totalStaked;
    uint256 public totalFrozen;
    bool public isMember;
    int256 public limit;
    uint256 public stakerBalance;
    uint256 public totalLockedStake;
    uint256 public totalFrozenAmount;

    function __UserManager_init() public {
        newMemberFee = 10**18; // Set the default membership fee
    }

    function setNewMemberFee(uint256 amount) public {
        newMemberFee = amount;
    }

    function setIsMember(bool isMember_) public {
        isMember = isMember_;
    }

    function checkIsMember(address) public view returns (bool) {
        return isMember;
    }

    function setStakerBalance(uint256 stakerBalance_) public {
        stakerBalance = stakerBalance_;
    }

    function getStakerBalance(address) public view returns (uint256) {
        return stakerBalance;
    }

    function setTotalLockedStake(uint256 totalLockedStake_) public {
        totalLockedStake = totalLockedStake_;
    }

    function getTotalLockedStake(address) public view returns (uint256) {
        return totalLockedStake;
    }

    function setTotalFrozenAmount(uint256 totalFrozenAmount_) public {
        totalFrozenAmount = totalFrozenAmount_;
    }

    function getTotalFrozenAmount(address) public view returns (uint256) {
        return totalFrozenAmount;
    }

    function setCreditLimit(int256 limit_) public {
        limit = limit_;
    }

    function getCreditLimit(address) public view returns (int256) {
        return limit;
    }

    function getBorrowerAddresses(address account) public view returns (address[] memory) {}

    function getStakerAddresses(address account) public view returns (address[] memory) {}

    function getBorrowerAsset(address account, address borrower)
        public
        view
        returns (
            uint256 trustAmount,
            uint256 vouchingAmount,
            uint256 lockedStake
        )
    {}

    function getStakerAsset(address account, address staker)
        public
        view
        returns (
            uint256 trustAmount,
            uint256 vouchingAmount,
            uint256 lockedStake
        )
    {}

    function getLockedStake(address staker, address borrower) public view returns (uint256) {}

    function getVouchingAmount(address staker, address borrower) public view returns (uint256) {}

    function addMember(address account) public {}

    function updateTrust(address borrower_, uint256 trustAmount) external {}

    function cancelVouch(address staker, address borrower) external {}

    function registerMemberWithPermit(
        address newMember,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {}

    function registerMember(address newMember) public {}

    function updateLockedData(
        address borrower,
        uint256 amount,
        bool isBorrow
    ) external {}

    function stake(uint256 amount) public {}

    /**
     *  @dev stakeWithPermit
     *  @param amount Amount
     */
    function stakeWithPermit(
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {}

    function unstake(uint256 amount) external {}

    function withdrawRewards() external {}

    function updateTotalFrozen(address, bool) external {}

    function batchUpdateTotalFrozen(address[] calldata, bool[] calldata) external {}

    function repayLoanOverdue(
        address account,
        address token,
        uint256 lastRepay
    ) external {}

    //Only supports sumOfTrust
    function debtWriteOff(address borrower, uint256 amount) public {}

    function getFrozenCoinAge(address staker, uint256 pastBlocks) public view returns (uint256) {}
}
