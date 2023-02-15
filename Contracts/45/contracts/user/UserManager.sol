//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../Controller.sol";
import "../interfaces/IAssetManager.sol";
import "../interfaces/ICreditLimitModel.sol";
import "../interfaces/IUserManager.sol";
import "../interfaces/IComptroller.sol";
import "../interfaces/IUnionToken.sol";
import "../interfaces/IDai.sol";
import "../interfaces/IUToken.sol";

/**
 * @title UserManager Contract
 * @dev Manages the Union members credit lines, and their vouchees and borrowers info.
 */
contract UserManager is Controller, IUserManager, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Member {
        bool isMember;
        CreditLine creditLine;
    }

    //address: member address, uint256: trustAmount
    struct CreditLine {
        mapping(address => uint256) borrowers;
        address[] borrowerAddresses;
        mapping(address => uint256) stakers;
        address[] stakerAddresses;
        mapping(address => uint256) lockedAmount;
    }

    struct TrustInfo {
        address[] stakerAddresses;
        address[] borrowerAddresses;
        uint256 effectiveCount;
        address staker;
        uint256 vouchingAmount;
        uint256 stakingAmount;
        uint256 availableStakingAmount;
        uint256 lockedStake;
        uint256 totalLockedStake;
    }

    uint256 public constant MAX_TRUST_LIMIT = 100;
    uint256 public constant MAX_STAKE_AMOUNT = 1000e18;
    address public stakingToken;
    address public unionToken;
    address public assetManager;
    IUToken public uToken;
    ICreditLimitModel public creditLimitModel;
    IComptroller public comptroller;
    uint256 public newMemberFee; // New member application fee

    // slither-disable-next-line constable-states
    uint256 public override totalStaked;
    // slither-disable-next-line constable-states
    uint256 public override totalFrozen;
    mapping(address => Member) private members;
    // slither-disable-next-line uninitialized-state
    mapping(address => uint256) public stakers; //1 user address 2 amount
    mapping(address => uint256) public memberFrozen; //1 user address 2 frozen amount

    modifier onlyMember(address account) {
        require(checkIsMember(account), "UserManager: caller does not have the Member role");
        _;
    }

    modifier onlyMarketOrAdmin() {
        require(
            address(uToken) == msg.sender || isAdmin(msg.sender),
            "UserManager: caller does not the market or admin"
        );
        _;
    }

    /**
     *  @dev Update new credit limit model event
     *  @param newCreditLimitModel New credit limit model address
     */
    event LogNewCreditLimitModel(address newCreditLimitModel);

    /**
     *  @dev Add new member event
     *  @param member New member address
     */
    event LogAddMember(address member);

    /**
     *  @dev Update vouch for existing member event
     *  @param staker Trustee address
     *  @param borrower The address gets vouched for
     *  @param trustAmount Vouch amount
     */
    event LogUpdateTrust(address indexed staker, address indexed borrower, uint256 trustAmount);

    /**
     *  @dev New member application event
     *  @param account New member's voucher address
     *  @param borrower New member address
     */
    event LogRegisterMember(address indexed account, address indexed borrower);

    /**
     *  @dev Cancel vouching for other member event
     *  @param account New member's voucher address
     *  @param borrower The address gets vouched for
     */
    event LogCancelVouch(address indexed account, address indexed borrower);

    /**
     *  @dev Stake event
     *  @param account The staker's address
     *  @param amount The amount of tokens to stake
     */
    event LogStake(address indexed account, uint256 amount);

    /**
     *  @dev Unstake event
     *  @param account The staker's address
     *  @param amount The amount of tokens to unstake
     */
    event LogUnstake(address indexed account, uint256 amount);

    /**
     *  @dev DebtWriteOff event
     *  @param staker The staker's address
     *  @param borrower The borrower's address
     *  @param amount The amount of write off
     */
    event LogDebtWriteOff(address indexed staker, address indexed borrower, uint256 amount);

    function __UserManager_init(
        address assetManager_,
        address unionToken_,
        address stakingToken_,
        address creditLimitModel_,
        address comptroller_,
        address admin_
    ) public initializer {
        Controller.__Controller_init(admin_);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        _setCreditLimitModel(creditLimitModel_);
        comptroller = IComptroller(comptroller_);
        assetManager = assetManager_;
        unionToken = unionToken_;
        stakingToken = stakingToken_;
        newMemberFee = 10**18; // Set the default membership fee
    }

    function setUToken(address uToken_) public onlyAdmin {
        uToken = IUToken(uToken_);
    }

    function setNewMemberFee(uint256 amount) public onlyAdmin {
        newMemberFee = amount;
    }

    /**
     *  @dev Change the credit limit model
     *  Accept claims only from the admin
     *  @param newCreditLimitModel New credit limit model address
     */
    function setCreditLimitModel(address newCreditLimitModel) public override onlyAdmin {
        _setCreditLimitModel(newCreditLimitModel);
    }

    function _setCreditLimitModel(address newCreditLimitModel) private {
        require(
            ICreditLimitModel(newCreditLimitModel).isCreditLimitModel(),
            "MemberMnager: new model is not a creditLimitModel"
        );
        creditLimitModel = ICreditLimitModel(newCreditLimitModel);

        emit LogNewCreditLimitModel(newCreditLimitModel);
    }

    /**
     *  @dev Check if the account is a valid member
     *  @param account Member address
     *  @return Address whether is member
     */
    function checkIsMember(address account) public view override returns (bool) {
        return members[account].isMember;
    }

    /**
     *  @dev Get member borrowerAddresses
     *  @param account Member address
     *  @return Address array
     */
    function getBorrowerAddresses(address account) public view override returns (address[] memory) {
        return members[account].creditLine.borrowerAddresses;
    }

    /**
     *  @dev Get member stakerAddresses
     *  @param account Member address
     *  @return Address array
     */
    function getStakerAddresses(address account) public view override returns (address[] memory) {
        return members[account].creditLine.stakerAddresses;
    }

    /**
     *  @dev Get member backer asset
     *  @param account Member address
     *  @param borrower Borrower address
     *  @return trustAmount vouchingAmount lockedStake. Trust amount, vouch amount, and locked stake amount
     */
    function getBorrowerAsset(address account, address borrower)
        public
        view
        override
        returns (
            uint256 trustAmount,
            uint256 vouchingAmount,
            uint256 lockedStake
        )
    {
        trustAmount = members[account].creditLine.borrowers[borrower];
        lockedStake = getLockedStake(account, borrower);
        vouchingAmount = getVouchingAmount(account, borrower);
    }

    /**
     *  @dev Get member stakers asset
     *  @param account Member address
     *  @param staker Staker address
     *  @return trustAmount lockedStake vouchingAmount. Vouch amount and lockedStake
     */
    function getStakerAsset(address account, address staker)
        public
        view
        override
        returns (
            uint256 trustAmount,
            uint256 vouchingAmount,
            uint256 lockedStake
        )
    {
        trustAmount = members[account].creditLine.stakers[staker];
        lockedStake = getLockedStake(staker, account);
        vouchingAmount = getVouchingAmount(staker, account);
    }

    /**
     *  @dev Get staker locked stake for a borrower
     *  @param staker Staker address
     *  @param borrower Borrower address
     *  @return LockedStake
     */
    function getLockedStake(address staker, address borrower) public view returns (uint256) {
        return members[staker].creditLine.lockedAmount[borrower];
    }

    /**
     *  @dev Get the user's locked stake from all his backed loans
     *  @param staker Staker address
     *  @return LockedStake
     */
    function getTotalLockedStake(address staker) public view override returns (uint256) {
        uint256 totalLockedStake = 0;
        uint256 stakingAmount = stakers[staker];
        address[] memory borrowerAddresses = members[staker].creditLine.borrowerAddresses;
        address borrower;
        for (uint256 i = 0; i < borrowerAddresses.length; i++) {
            borrower = borrowerAddresses[i];
            totalLockedStake += getLockedStake(staker, borrower);
        }

        if (stakingAmount >= totalLockedStake) {
            return totalLockedStake;
        } else {
            return stakingAmount;
        }
    }

    /**
     *  @dev Get staker's defaulted / frozen staked token amount
     *  @param staker Staker address
     *  @return Frozen token amount
     */
    function getTotalFrozenAmount(address staker) public view override returns (uint256) {
        TrustInfo memory trustInfo;
        uint256 totalFrozenAmount = 0;
        trustInfo.borrowerAddresses = members[staker].creditLine.borrowerAddresses;
        trustInfo.stakingAmount = stakers[staker];

        address borrower;
        for (uint256 i = 0; i < trustInfo.borrowerAddresses.length; i++) {
            borrower = trustInfo.borrowerAddresses[i];
            if (uToken.checkIsOverdue(borrower)) {
                totalFrozenAmount += getLockedStake(staker, borrower);
            }
        }

        if (trustInfo.stakingAmount >= totalFrozenAmount) {
            return totalFrozenAmount;
        } else {
            return trustInfo.stakingAmount;
        }
    }

    /**
     *  @dev Get the member's available credit line
     *  @param borrower Member address
     *  @return Credit line amount
     */
    function getCreditLimit(address borrower) public view override returns (int256) {
        TrustInfo memory trustInfo;
        trustInfo.stakerAddresses = members[borrower].creditLine.stakerAddresses;
        // Get the number of effective vouchee, first
        trustInfo.effectiveCount = 0;
        uint256[] memory limits = new uint256[](trustInfo.stakerAddresses.length);

        for (uint256 i = 0; i < trustInfo.stakerAddresses.length; i++) {
            trustInfo.staker = trustInfo.stakerAddresses[i];

            trustInfo.stakingAmount = stakers[trustInfo.staker];

            trustInfo.vouchingAmount = getVouchingAmount(trustInfo.staker, borrower);

            //A vouchingAmount value of 0 means that the amount of stake is 0 or trust is 0. In this case, this data is not used to calculate the credit limit
            if (trustInfo.vouchingAmount > 0) {
                //availableStakingAmount is staker‘s free stake amount
                trustInfo.borrowerAddresses = getBorrowerAddresses(trustInfo.staker);

                trustInfo.availableStakingAmount = trustInfo.stakingAmount;
                uint256 totalLockedStake = getTotalLockedStake(trustInfo.staker);
                if (trustInfo.stakingAmount <= totalLockedStake) {
                    trustInfo.availableStakingAmount = 0;
                } else {
                    trustInfo.availableStakingAmount = trustInfo.stakingAmount - totalLockedStake;
                }

                trustInfo.lockedStake = getLockedStake(trustInfo.staker, borrower);

                require(
                    trustInfo.vouchingAmount >= trustInfo.lockedStake,
                    "UserManager: vouchingAmount or lockedStake data error"
                );

                //The actual effective guarantee amount cannot exceed availableStakingAmount,
                if (trustInfo.vouchingAmount >= trustInfo.availableStakingAmount + trustInfo.lockedStake) {
                    limits[trustInfo.effectiveCount] = trustInfo.availableStakingAmount;
                } else {
                    if (trustInfo.vouchingAmount <= trustInfo.lockedStake) {
                        limits[trustInfo.effectiveCount] = 0;
                    } else {
                        limits[trustInfo.effectiveCount] = trustInfo.vouchingAmount - trustInfo.lockedStake;
                    }
                }
                trustInfo.effectiveCount += 1;
            }
        }

        uint256[] memory creditlimits = new uint256[](trustInfo.effectiveCount);
        for (uint256 j = 0; j < trustInfo.effectiveCount; j++) {
            creditlimits[j] = limits[j];
        }

        return int256(creditLimitModel.getCreditLimit(creditlimits)) - int256(uToken.calculatingInterest(borrower));
    }

    /**
     *  @dev Get vouching amount
     *  @param staker Staker address
     *  @param borrower Borrower address
     */
    function getVouchingAmount(address staker, address borrower) public view returns (uint256) {
        uint256 totalStake = stakers[staker];
        uint256 trustAmount = members[borrower].creditLine.stakers[staker];
        if (trustAmount > totalStake) {
            return totalStake;
        } else {
            return trustAmount;
        }
    }

    /**
     *  @dev Get the user's deposited stake amount
     *  @param account Member address
     *  @return Deposited stake amount
     */
    function getStakerBalance(address account) public view override returns (uint256) {
        return stakers[account];
    }

    /**
     *  @dev Add member
     *  Accept claims only from the admin
     *  @param account Member address
     */
    function addMember(address account) public override onlyAdmin {
        require(!checkIsMember(account), "UserManager: address is already member");
        members[account].isMember = true;
        emit LogAddMember(account);
    }

    /**
     *  @dev Update the trust amount for exisitng members.
     *  @param borrower_ Account address
     *  @param trustAmount Trust amount
     */
    function updateTrust(address borrower_, uint256 trustAmount)
        external
        override
        onlyMember(msg.sender)
        whenNotPaused
    {
        require(borrower_ != address(0), "borrower cannot be zero");
        address borrower = borrower_;

        TrustInfo memory trustInfo;
        trustInfo.staker = msg.sender;
        require(trustInfo.staker != borrower, "UserManager: Can't vouch for self");
        require(
            members[borrower].creditLine.stakerAddresses.length < MAX_TRUST_LIMIT &&
                members[trustInfo.staker].creditLine.borrowerAddresses.length < MAX_TRUST_LIMIT,
            "UserManager: trust reach limit"
        );
        trustInfo.borrowerAddresses = members[trustInfo.staker].creditLine.borrowerAddresses;
        trustInfo.stakerAddresses = members[borrower].creditLine.stakerAddresses;
        trustInfo.lockedStake = getLockedStake(trustInfo.staker, borrower);
        require(
            trustAmount >= trustInfo.lockedStake,
            "UserManager: trust amount cannot be less than the locked amount "
        );
        uint256 borrowerCount = members[trustInfo.staker].creditLine.borrowerAddresses.length;
        bool borrowerExist = false;
        for (uint256 i = 0; i < borrowerCount; i++) {
            if (trustInfo.borrowerAddresses[i] == borrower) {
                borrowerExist = true;
            }
        }

        uint256 stakerCount = members[borrower].creditLine.stakerAddresses.length;
        bool stakerExist = false;
        for (uint256 i = 0; i < stakerCount; i++) {
            if (trustInfo.stakerAddresses[i] == trustInfo.staker) {
                stakerExist = true;
            }
        }

        if (!borrowerExist) {
            members[trustInfo.staker].creditLine.borrowerAddresses.push(borrower);
        }

        if (!stakerExist) {
            members[borrower].creditLine.stakerAddresses.push(trustInfo.staker);
        }

        members[trustInfo.staker].creditLine.borrowers[borrower] = trustAmount;
        members[borrower].creditLine.stakers[trustInfo.staker] = trustAmount;
        emit LogUpdateTrust(trustInfo.staker, borrower, trustAmount);
    }

    /**
     *  @dev Stop vouch for other member.
     *  @param staker Staker address
     *  @param borrower borrower address
     */
    function cancelVouch(address staker, address borrower) external override onlyMember(msg.sender) whenNotPaused {
        require(
            msg.sender == staker || msg.sender == borrower,
            "UserManager: Accept claims only from the staker or borrower"
        );

        require(getLockedStake(staker, borrower) == 0, "UserManager: LockedStake is not zero");

        uint256 stakerCount = members[borrower].creditLine.stakerAddresses.length;
        bool stakerExist = false;
        uint256 stakerIndex = 0;
        for (uint256 i = 0; i < stakerCount; i++) {
            if (members[borrower].creditLine.stakerAddresses[i] == staker) {
                stakerExist = true;
                stakerIndex = i;
            }
        }

        uint256 borrowerCount = members[staker].creditLine.borrowerAddresses.length;
        bool borrowerExist = false;
        uint256 borrowerIndex = 0;
        for (uint256 i = 0; i < borrowerCount; i++) {
            if (members[staker].creditLine.borrowerAddresses[i] == borrower) {
                borrowerExist = true;
                borrowerIndex = i;
            }
        }

        //delete address
        if (borrowerExist) {
            members[staker].creditLine.borrowerAddresses[borrowerIndex] = members[staker].creditLine.borrowerAddresses[
                borrowerCount - 1
            ];
            members[staker].creditLine.borrowerAddresses.pop();
        }

        if (stakerExist) {
            members[borrower].creditLine.stakerAddresses[stakerIndex] = members[borrower].creditLine.stakerAddresses[
                stakerCount - 1
            ];
            members[borrower].creditLine.stakerAddresses.pop();
        }

        delete members[staker].creditLine.borrowers[borrower];
        delete members[borrower].creditLine.stakers[staker];

        emit LogCancelVouch(staker, borrower);
    }

    function registerMemberWithPermit(
        address newMember,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public whenNotPaused {
        IUnionToken unionTokenContract = IUnionToken(unionToken);
        unionTokenContract.permit(msg.sender, address(this), value, deadline, v, r, s);
        registerMember(newMember);
    }

    /**
     *  @dev Apply for membership, and burn UnionToken as application fees
     *  @param newMember New member address
     */
    function registerMember(address newMember) public override whenNotPaused {
        IUnionToken unionTokenContract = IUnionToken(unionToken);
        require(!checkIsMember(newMember), "UserManager: address is already member");
        require(unionTokenContract.balanceOf(msg.sender) >= newMemberFee, "UserManager: balance not enough");

        uint256 effectiveStakerNumber = 0;
        for (uint256 i = 0; i < members[newMember].creditLine.stakerAddresses.length; i++) {
            address stakerAddress = members[newMember].creditLine.stakerAddresses[i];
            if (checkIsMember(stakerAddress) && getVouchingAmount(stakerAddress, newMember) > 0)
                effectiveStakerNumber += 1;
        }

        require(
            effectiveStakerNumber >= creditLimitModel.effectiveNumber(),
            "UserManager: not enough effective stakers"
        );

        members[newMember].isMember = true;

        unionTokenContract.burnFrom(msg.sender, newMemberFee);

        emit LogRegisterMember(msg.sender, newMember);
    }

    function updateLockedData(
        address borrower,
        uint256 amount,
        bool isBorrow
    ) external override onlyMarketOrAdmin {
        TrustInfo memory trustInfo;
        trustInfo.stakerAddresses = members[borrower].creditLine.stakerAddresses;

        ICreditLimitModel.LockedInfo[] memory lockedInfoList = new ICreditLimitModel.LockedInfo[](
            trustInfo.stakerAddresses.length
        );

        for (uint256 i = 0; i < trustInfo.stakerAddresses.length; i++) {
            ICreditLimitModel.LockedInfo memory lockedInfo;

            trustInfo.staker = trustInfo.stakerAddresses[i];
            trustInfo.stakingAmount = stakers[trustInfo.staker];
            trustInfo.vouchingAmount = getVouchingAmount(trustInfo.staker, borrower);

            trustInfo.totalLockedStake = getTotalLockedStake(trustInfo.staker);
            if (trustInfo.stakingAmount <= trustInfo.totalLockedStake) {
                trustInfo.availableStakingAmount = 0;
            } else {
                trustInfo.availableStakingAmount = trustInfo.stakingAmount - trustInfo.totalLockedStake;
            }

            lockedInfo.staker = trustInfo.staker;
            lockedInfo.vouchingAmount = trustInfo.vouchingAmount;
            lockedInfo.lockedAmount = getLockedStake(trustInfo.staker, borrower);
            lockedInfo.availableStakingAmount = trustInfo.availableStakingAmount;

            lockedInfoList[i] = lockedInfo;
        }

        for (uint256 i = 0; i < lockedInfoList.length; i++) {
            members[lockedInfoList[i].staker].creditLine.lockedAmount[borrower] = creditLimitModel.getLockedAmount(
                lockedInfoList,
                lockedInfoList[i].staker,
                amount,
                isBorrow
            );
        }
    }

    /**
     *  @dev Stake
     *  @param amount Amount
     */
    function stake(uint256 amount) public override whenNotPaused nonReentrant {
        IERC20Upgradeable erc20Token = IERC20Upgradeable(stakingToken);

        comptroller.withdrawRewards(msg.sender, stakingToken);

        uint256 balance = stakers[msg.sender];

        require(balance + amount <= MAX_STAKE_AMOUNT, "UserManager: Stake limit hit");

        stakers[msg.sender] = balance + amount;
        totalStaked += amount;

        require(
            erc20Token.allowance(msg.sender, address(this)) >= amount,
            "UserManager: not enough allowance to stake"
        );
        erc20Token.safeTransferFrom(msg.sender, address(this), amount);
        erc20Token.safeApprove(assetManager, 0);
        erc20Token.safeApprove(assetManager, amount);

        require(IAssetManager(assetManager).deposit(stakingToken, amount), "UserManager: Deposit failed");

        emit LogStake(msg.sender, amount);
    }

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
    ) public whenNotPaused {
        IDai erc20Token = IDai(stakingToken);
        erc20Token.permit(msg.sender, address(this), nonce, expiry, true, v, r, s);

        stake(amount);
    }

    /**
     *  @dev Unstake
     *  @param amount Amount
     */
    function unstake(uint256 amount) external override whenNotPaused nonReentrant {
        IERC20Upgradeable erc20Token = IERC20Upgradeable(stakingToken);
        uint256 stakingAmount = stakers[msg.sender];
        require(
            stakingAmount - getTotalLockedStake(msg.sender) >= amount,
            "UserManager: unstake balance is insufficient"
        );

        comptroller.withdrawRewards(msg.sender, stakingToken);

        stakers[msg.sender] = stakingAmount - amount;
        totalStaked -= amount;

        require(
            IAssetManager(assetManager).withdraw(stakingToken, address(this), amount),
            "UserManager: withdraw failed"
        );

        erc20Token.safeTransfer(msg.sender, amount);

        emit LogUnstake(msg.sender, amount);
    }

    function withdrawRewards() external whenNotPaused nonReentrant {
        uint256 rewards = comptroller.withdrawRewards(msg.sender, stakingToken);
        require(rewards > 0, "UserManager: not enough rewards");
    }

    /**
     *  @dev Repay user's loan overdue, called only from the lending market
     *  @param account User address
     *  @param token The asset token repaying to
     *  @param lastRepay Last repay block number
     */
    function repayLoanOverdue(
        address account,
        address token,
        uint256 lastRepay
    ) external override whenNotPaused onlyMarketOrAdmin {
        address[] memory stakerAddresses = getStakerAddresses(account);
        for (uint256 i = 0; i < stakerAddresses.length; i++) {
            address staker = stakerAddresses[i];
            (, , uint256 lockedStake) = getStakerAsset(account, staker);

            comptroller.addFrozenCoinAge(staker, token, lockedStake, lastRepay);
        }
    }

    //Only supports sumOfTrust
    function debtWriteOff(address borrower, uint256 amount) public {
        require(amount > 0, "UserManager: amount can not be zero");
        require(totalStaked >= amount, "UserManager: amount exceeds the totalStaked");
        require(uToken.checkIsOverdue(borrower), "UserManager: only call when borrower is overdue");
        uint256 lockedAmount = getLockedStake(msg.sender, borrower);
        require(lockedAmount >= amount, "UserManager: amount exceeds the locked amount");

        _updateTotalFrozen(borrower, true);
        require(totalFrozen >= amount, "UserManager: amount exceeds the totalFrozen");
        comptroller.withdrawRewards(msg.sender, stakingToken);

        //The borrower is still overdue, do not call comptroller.addFrozenCoinAge

        stakers[msg.sender] -= amount;
        totalStaked -= amount;
        totalFrozen -= amount;
        if (memberFrozen[borrower] >= amount) {
            memberFrozen[borrower] -= amount;
        } else {
            memberFrozen[borrower] = 0;
        }
        members[msg.sender].creditLine.lockedAmount[borrower] = lockedAmount - amount;
        uint256 trustAmount = members[msg.sender].creditLine.borrowers[borrower];
        uint256 newTrustAmount = trustAmount - amount;
        members[msg.sender].creditLine.borrowers[borrower] = newTrustAmount;
        members[borrower].creditLine.stakers[msg.sender] = newTrustAmount;
        IAssetManager(assetManager).debtWriteOff(stakingToken, amount);
        uToken.debtWriteOff(borrower, amount);
        emit LogDebtWriteOff(msg.sender, borrower, amount);
    }

    /**
     *  @dev Update total frozen
     *  @param account borrower address
     *  @param isOverdue account is overdue
     */
    function updateTotalFrozen(address account, bool isOverdue) external override onlyMarketOrAdmin whenNotPaused {
        require(totalStaked >= totalFrozen, "UserManager: total stake amount error");
        uint256 effectiveTotalStaked = totalStaked - totalFrozen;
        comptroller.updateTotalStaked(stakingToken, effectiveTotalStaked);
        _updateTotalFrozen(account, isOverdue);
    }

    function batchUpdateTotalFrozen(address[] calldata accounts, bool[] calldata isOverdues)
        external
        override
        onlyMarketOrAdmin
        whenNotPaused
    {
        require(accounts.length == isOverdues.length, "UserManager: params length error");
        require(totalStaked >= totalFrozen, "UserManager: total stake amount error");
        uint256 effectiveTotalStaked = totalStaked - totalFrozen;
        comptroller.updateTotalStaked(stakingToken, effectiveTotalStaked);
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0)) _updateTotalFrozen(accounts[i], isOverdues[i]);
        }
    }

    function _updateTotalFrozen(address account, bool isOverdue) private {
        if (isOverdue) {
            //isOverdue = true, user overdue needs to increase totalFrozen

            //The sum of the locked amount of all stakers on this borrower, which is the frozen amount that needs to be updated
            uint256 amount;
            for (uint256 i = 0; i < members[account].creditLine.stakerAddresses.length; i++) {
                address staker = members[account].creditLine.stakerAddresses[i];
                uint256 lockedStake = getLockedStake(staker, account);
                amount += lockedStake;
            }

            if (memberFrozen[account] == 0) {
                //I haven’t updated the frozen amount about this borrower before, just increase the amount directly
                totalFrozen += amount;
            } else {
                //I have updated the frozen amount of this borrower before. After increasing the amount, subtract the previously increased value to avoid repeated additions.
                totalFrozen = totalFrozen + amount - memberFrozen[account];
            }
            //Record the increased value of this borrower this time
            memberFrozen[account] = amount;
        } else {
            //isOverdue = false, the user loan needs to reduce the number of frozen last time to return to normal
            if (totalFrozen > memberFrozen[account]) {
                //Minus the frozen amount added last time
                totalFrozen -= memberFrozen[account];
            } else {
                totalFrozen = 0;
            }
            memberFrozen[account] = 0;
        }
    }

    function getFrozenCoinAge(address staker, uint256 pastBlocks) public view override returns (uint256) {
        uint256 totalFrozenCoinAge = 0;

        address[] memory borrowerAddresses = getBorrowerAddresses(staker);

        for (uint256 i = 0; i < borrowerAddresses.length; i++) {
            address borrower = borrowerAddresses[i];
            uint256 blocks = block.number - uToken.getLastRepay(borrower);
            if (uToken.checkIsOverdue(borrower)) {
                (, , uint256 lockedStake) = getStakerAsset(borrower, staker);

                if (pastBlocks >= blocks) {
                    totalFrozenCoinAge = totalFrozenCoinAge + (lockedStake * blocks);
                } else {
                    totalFrozenCoinAge = totalFrozenCoinAge + (lockedStake * pastBlocks);
                }
            }
        }

        return totalFrozenCoinAge;
    }

    function _getFrozenCoinAge(address staker, uint256 pastBlocks) private view returns (uint256) {
        uint256 totalFrozenCoinAge = 0;

        address[] memory borrowerAddresses = getBorrowerAddresses(staker);

        for (uint256 i = 0; i < borrowerAddresses.length; i++) {
            address borrower = borrowerAddresses[i];
            uint256 blocks = block.number - uToken.getLastRepay(borrower);
            if (uToken.checkIsOverdue(borrower)) {
                (, , uint256 lockedStake) = getStakerAsset(borrower, staker);

                if (pastBlocks >= blocks) {
                    totalFrozenCoinAge += lockedStake * blocks;
                } else {
                    totalFrozenCoinAge += lockedStake * pastBlocks;
                }
            }
        }

        return totalFrozenCoinAge;
    }
}
