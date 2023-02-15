// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IYVault.sol";

/// @title JPEG'd yVault token farm
/// @notice Users can stake their JPEG'd vault tokens and earn JPEG rewards
/// @dev The rewards are taken from the PUSD Convex pool and distributed to stakers based on their share of the total staked tokens.
contract YVaultLPFarming is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IYVault;
    using Address for address;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 rewards);

    IYVault public immutable vault;
    IERC20 public immutable jpeg;

    uint256 public totalStaked;

    uint256 internal lastRewardBlock;
    uint256 internal previousBalance;
    uint256 internal accRewardPerShare;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) private userLastAccRewardPerShare;
    mapping(address => uint256) private userPendingRewards;

    /// @notice Contracts that are allowed to interact with the LP farm
    /// @dev See the {noContract} modifier for more info
    mapping(address => bool) public whitelistedContracts;

    ///@param _vault The yVault address
    ///@param _jpeg The JPEG token address
    constructor(address _vault, address _jpeg) {
        require(_vault != address(0), "INVALID_VAULT");
        require(_jpeg != address(0), "INVALID_JPEG");

        vault = IYVault(_vault);
        jpeg = IERC20(_jpeg);
    }

    /// @dev Modifier that ensures that non-whitelisted contracts can't interact with the farm.
    /// Prevents non-whitelisted 3rd party contracts (e.g. autocompounders) from diluting farmers.
    /// The {isContract} function returns false when `_account` is a contract executing constructor code.
    /// This may lead to some contracts being able to bypass this check.
    /// @param _account Address to check
    modifier noContract(address _account) {
        require(
            !_account.isContract() || whitelistedContracts[_account],
            "Contracts aren't allowed to farm"
        );
        _;
    }

    /// @notice Allows the owner to whitelist/blacklist contracts
    /// @param _contract The contract address to whitelist/blacklist
    /// @param _isWhitelisted Whereter to whitelist or blacklist `_contract`
    function setContractWhitelisted(address _contract, bool _isWhitelisted)
        external
        onlyOwner
    {
        whitelistedContracts[_contract] = _isWhitelisted;
    }

    /// @notice Frontend function used to calculate the amount of rewards `_user` can claim
    /// @param _user The address of the user
    /// @return The amount of rewards claimable by user `_user`
    function pendingReward(address _user)
        external
        view
        returns (uint256)
    {
        uint256 rewardShare = accRewardPerShare;
        uint256 staked = totalStaked;
        //if blockNumber is greater than the pool's `lastRewardBlock` the pool's `accRewardPerShare` is outdated,
        //we need to calculate the up to date amount to return an accurate reward value
        if (block.number > lastRewardBlock && staked > 0) {
            (rewardShare, ) = _computeUpdate();
        }
        return
            //rewards that the user had already accumulated but not claimed
            userPendingRewards[_user] +
            //subtracting the user's `lastAccRewardPerShare` from the pool's `accRewardPerShare` results in the amount of rewards per share
            //the pool has accumulated since the user's last claim, multiplying it by the user's shares results in the amount of new rewards claimable
            //by the user
            (balanceOf[_user] * (rewardShare - userLastAccRewardPerShare[_user])) /
            1e36;
    }

    /// @notice Allows users to deposit `_amount` of vault tokens. Non whitelisted contracts can't call this function
    /// @dev Emits a {Deposit} event
    /// @param _amount The amount of tokens to deposit
    function deposit(uint256 _amount) external noContract(msg.sender) {
        require(_amount > 0, "invalid_amount");

        _update();
        _withdrawReward(msg.sender);

        vault.safeTransferFrom(msg.sender, address(this), _amount);

        balanceOf[msg.sender] += _amount;
        totalStaked += _amount;

        emit Deposit(msg.sender, _amount);
    }

    /// @notice Allows users to withdraw `_amount` of vault tokens. Non whitelisted contracts can't call this function
    /// @dev Emits a {Withdraw} event
    /// @param _amount The amount of tokens to withdraw
    function withdraw(uint256 _amount) external noContract(msg.sender) {
        require(_amount > 0, "invalid_amount");
        require(balanceOf[msg.sender] >= _amount, "insufficient_amount");

        _update();
        _withdrawReward(msg.sender);

        balanceOf[msg.sender] -= _amount;
        totalStaked -= _amount;

        vault.safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount);
    }

    /// @notice Allows users to claim rewards. Non whitelisted contracts can't call this function
    /// @dev Emits a {Claim} event
    function claim() external noContract(msg.sender) {
        _update();
        _withdrawReward(msg.sender);

        uint256 rewards = userPendingRewards[msg.sender];
        require(rewards > 0, "no_reward");

        userPendingRewards[msg.sender] = 0;
        //we are subtracting the claimed rewards from the previous to have a consistent value next time
        //{_update is called}
        previousBalance -= rewards;

        if (jpeg.balanceOf(address(this)) < rewards)
            vault.withdrawJPEG();

        jpeg.safeTransfer(msg.sender, rewards);

        emit Claim(msg.sender, rewards);
    }

    /// @dev Updates this contract's rewards state
    function _update() internal {
        if (block.number <= lastRewardBlock) return;

        lastRewardBlock = block.number;

        if (totalStaked == 0) return;

        (accRewardPerShare, previousBalance) = _computeUpdate();
    }

    /// @dev Computes the updated contract state without writing storage
    /// @return newAccRewardsPerShare The new value of `accRewardsPerShare`
    /// @return currentBalance The new value of `previousBalance`
    function _computeUpdate() internal view returns (uint256 newAccRewardsPerShare, uint256 currentBalance) {
        currentBalance = vault.balanceOfJPEG() + jpeg.balanceOf(address(this));
        uint256 newRewards = currentBalance - previousBalance;

        newAccRewardsPerShare = accRewardPerShare + newRewards * 1e36 / totalStaked;
    }

    /// @dev Updates `account`'s claimable rewards by adding pending rewards
    /// @param account The account to update
    function _withdrawReward(address account) internal returns (uint256) {
        uint256 pending = (balanceOf[account] *
            (accRewardPerShare - userLastAccRewardPerShare[account])) / 1e36;

        if (pending > 0) userPendingRewards[account] += pending;

        userLastAccRewardPerShare[account] = accRewardPerShare;

        return pending;
    }

    /// @dev Prevent the owner from renouncing ownership. Having no owner would render this contract unusable due to the inability to create new epochs
    function renounceOwnership() public view override onlyOwner {
        revert("Cannot renounce ownership");
    }
}
