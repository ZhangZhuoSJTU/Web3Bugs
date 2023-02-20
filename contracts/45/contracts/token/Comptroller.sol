//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../Controller.sol";
import "../WadRayMath.sol";
import "../interfaces/IComptroller.sol";
import "../interfaces/IMarketRegistry.sol";
import "../interfaces/IUserManager.sol";

//For the time being, only the reward calculation of a single token is supported, and the contract needs to be revised after determining the reward calculation scheme of multiple tokens
contract Comptroller is Controller, IComptroller {
    using WadRayMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Info {
        uint256 frozenCoinAge;
        uint256 updatedBlock; //last withdraw rewards block
        uint256 inflationIndex; //last withdraw rewards inflationIndex
        uint256 accrued; //the unionToken accrued but not yet transferred to each user
    }

    struct UserManagerData {
        uint256 userStaked;
        uint256 totalFrozen;
        uint256 totalStaked;
        uint256 userFrozen;
        uint256 frozenCoinAge;
        uint256 totalLocked;
        bool isMember;
    }

    uint256 public constant INIT_INFLATION_INDEX = 10**18;
    uint256 public constant nonMemberRatio = 75 * 10**16; // 75%;
    uint256 public constant memberRatio = 10**18; // 100%;
    uint256 public halfDecayPoint;
    uint256 public gInflationIndex; // store the latest inflation index
    uint256 public gLastUpdatedBlock; // block number when updating the inflation index
    IERC20Upgradeable public unionToken;
    IMarketRegistry public marketRegistry;
    //1 address account, 2 address token
    mapping(address => mapping(address => Info)) public users;

    modifier onlyUserManager(address token) {
        require(msg.sender == _getUserManager(token), "UnionToken: only user manager can call");
        _;
    }

    /**
     *  @dev Withdraw rewards event
     *  @param account The staker's address
     *  @param amount The amount of Union tokens to withdraw
     */
    event LogWithdrawRewards(address indexed account, uint256 amount);

    function __Comptroller_init(address unionToken_, address marketRegistry_) public initializer {
        Controller.__Controller_init(msg.sender);
        unionToken = IERC20Upgradeable(unionToken_);
        marketRegistry = IMarketRegistry(marketRegistry_);
        gInflationIndex = INIT_INFLATION_INDEX;
        gLastUpdatedBlock = block.number;
        halfDecayPoint = 100000;
    }

    function setHalfDecayPoint(uint256 point) public onlyAdmin {
        halfDecayPoint = point;
    }

    /**
     *  @dev Get the reward multipier based on the account status
     *  @param account Account address
     *  @param token ERC20 token address
     *  @return Multiplier number (in wei)
     */
    function getRewardsMultiplier(address account, address token) public view override returns (uint256) {
        IUserManager userManagerContract = IUserManager(_getUserManager(token));
        uint256 stakingAmount = userManagerContract.getStakerBalance(account);
        uint256 lockedStake = userManagerContract.getTotalLockedStake(account);
        uint256 totalFrozen = userManagerContract.getTotalFrozenAmount(account);
        bool isMember = userManagerContract.checkIsMember(account);
        return _getRewardsMultiplier(stakingAmount, lockedStake, totalFrozen, isMember);
    }

    /**
     *  @dev Withdraw rewards
     *  @param token Staking token address
     *  @return Amount of rewards
     */
    function withdrawRewards(address sender, address token)
        external
        override
        whenNotPaused
        onlyUserManager(token)
        returns (uint256)
    {
        uint256 amount = calculateRewardsByBlocks(sender, token, 0);
        IUserManager userManagerContract = IUserManager(_getUserManager(token));
        // update the global states
        uint256 totalStaked_ = userManagerContract.totalStaked() - userManagerContract.totalFrozen();
        gInflationIndex = _getInflationIndexNew(totalStaked_, block.number - gLastUpdatedBlock);
        gLastUpdatedBlock = block.number;
        users[sender][token].frozenCoinAge = 0;
        users[sender][token].updatedBlock = block.number;
        users[sender][token].inflationIndex = gInflationIndex;
        if (unionToken.balanceOf(address(this)) >= amount && amount > 0) {
            unionToken.safeTransfer(sender, amount);
            users[sender][token].accrued = 0;
            emit LogWithdrawRewards(sender, amount);

            return amount;
        } else {
            users[sender][token].accrued = amount;
            emit LogWithdrawRewards(sender, 0);

            return 0;
        }
    }

    /**
     *  @dev Calculate unclaimed rewards based on blocks
     *  @param account User address
     *  @param token Staking token address
     *  @param futureBlocks Number of blocks in the future
     *  @return Unclaimed rewards
     */
    function calculateRewardsByBlocks(
        address account,
        address token,
        uint256 futureBlocks
    ) public view override returns (uint256) {
        IUserManager userManagerContract = IUserManager(_getUserManager(token));
        Info memory userInfo = users[account][token];
        UserManagerData memory userManagerData;

        userManagerData.totalFrozen = userManagerContract.totalFrozen();
        userManagerData.userStaked = userManagerContract.getStakerBalance(account);
        userManagerData.userFrozen = userManagerContract.getTotalFrozenAmount(account);
        userManagerData.totalStaked = userManagerContract.totalStaked() - userManagerData.totalFrozen;

        uint256 lastUpdatedBlock = userInfo.updatedBlock;
        if (block.number < lastUpdatedBlock) {
            lastUpdatedBlock = block.number;
        }

        uint256 pastBlocks = block.number - lastUpdatedBlock + futureBlocks;
        userManagerData.frozenCoinAge =
            userManagerContract.getFrozenCoinAge(account, pastBlocks) +
            userInfo.frozenCoinAge;

        userManagerData.totalLocked = userManagerContract.getTotalLockedStake(account);
        userManagerData.isMember = userManagerContract.checkIsMember(account);

        uint256 inflationIndex = _getRewardsMultiplier(
            userManagerData.userStaked,
            userManagerData.totalLocked,
            userManagerData.userFrozen,
            userManagerData.isMember
        );

        return
            userInfo.accrued +
            _calculateRewards(
                account,
                token,
                userManagerData.totalStaked,
                userManagerData.userStaked,
                userManagerData.frozenCoinAge,
                pastBlocks,
                inflationIndex
            );
    }

    /**
     *  @dev Calculate currently unclaimed rewards
     *  @param account Account address
     *  @param token Staking token address
     *  @return Unclaimed rewards
     */
    function calculateRewards(address account, address token) public view override returns (uint256) {
        return calculateRewardsByBlocks(account, token, 0);
    }

    /**
     *  @dev When total staked change update inflation index
     *  @param totalStaked totalStaked amount
     *  @return Whether succeeded
     */
    function updateTotalStaked(address token, uint256 totalStaked)
        external
        override
        whenNotPaused
        onlyUserManager(token)
        returns (bool)
    {
        if (totalStaked > 0) {
            gInflationIndex = _getInflationIndexNew(totalStaked, block.number - gLastUpdatedBlock);
        }
        gLastUpdatedBlock = block.number;

        return true;
    }

    function addFrozenCoinAge(
        address staker,
        address token,
        uint256 lockedStake,
        uint256 lastRepay
    ) external override onlyUserManager(token) {
        uint256 lastBlock = users[staker][token].updatedBlock;
        uint256 blocks;
        if (lastBlock > lastRepay) {
            // Frozen CoinAge here has been accounted for when the user withdraws the rewards, so here just need to calculate the delta between block.number and lastBlock
            blocks = block.number - lastBlock;
        } else {
            blocks = block.number - lastRepay;
        }

        users[staker][token].frozenCoinAge += lockedStake * blocks;
    }

    /**
     *  @dev Calculate new inflation index based on # of blocks
     *  @param totalStaked_ Number of total staked tokens in the system
     *  @param blockDelta Number of blocks
     *  @return New inflation index
     */
    function _getInflationIndexNew(uint256 totalStaked_, uint256 blockDelta) private view returns (uint256) {
        if (totalStaked_ == 0) {
            return INIT_INFLATION_INDEX;
        }

        if (blockDelta == 0) {
            return gInflationIndex;
        }

        return _getInflationIndex(totalStaked_, gInflationIndex, blockDelta);
    }

    function _calculateRewards(
        address account,
        address token,
        uint256 totalStaked,
        uint256 userStaked,
        uint256 frozenCoinAge,
        uint256 pastBlocks,
        uint256 inflationIndex
    ) private view returns (uint256) {
        uint256 startInflationIndex = users[account][token].inflationIndex;
        require(userStaked * pastBlocks >= frozenCoinAge, " Comptroller: frozen coin age error");

        if (userStaked == 0 || totalStaked == 0 || startInflationIndex == 0 || pastBlocks == 0) {
            return 0;
        }

        uint256 effectiveStakeAmount = (userStaked * pastBlocks - frozenCoinAge) / pastBlocks;

        uint256 curInflationIndex = _getInflationIndexNew(totalStaked, pastBlocks);

        require(curInflationIndex >= startInflationIndex, "Comptroller: inflationIndex error");

        return (curInflationIndex - startInflationIndex).wadMul(effectiveStakeAmount).wadMul(inflationIndex);
    }

    function _getUserManager(address token) private view returns (address userManager) {
        (, userManager) = marketRegistry.tokens(token);
    }

    /**
     *  @dev Calculate inflation per block
     *  @param effectiveTotalStake Effective total stake
     *  @return Inflation amount, div totalSupply is the inflation rate
     */
    function inflationPerBlock(uint256 effectiveTotalStake) public view returns (uint256) {
        uint256 index = effectiveTotalStake / halfDecayPoint;
        return lookup(index);
    }

    function lookup(uint256 index) public pure returns (uint256) {
        if (index <= 0.00001 * 10**18) {
            return 1 * 10**18;
        } else if (index <= 0.0001 * 10**18) {
            return 0.9 * 10**18;
        } else if (index <= 0.001 * 10**18) {
            return 0.8 * 10**18;
        } else if (index <= 0.01 * 10**18) {
            return 0.7 * 10**18;
        } else if (index <= 0.1 * 10**18) {
            return 0.6 * 10**18;
        } else if (index <= 1 * 10**18) {
            return 0.5 * 10**18;
        } else if (index <= 5 * 10**18) {
            return 0.25 * 10**18;
        } else if (index <= 10 * 10**18) {
            return 0.1 * 10**18;
        } else if (index <= 100 * 10**18) {
            return 0.01 * 10**18;
        } else if (index <= 1000 * 10**18) {
            return 0.001 * 10**18;
        } else if (index <= 10000 * 10**18) {
            return 0.0001 * 10**18;
        } else if (index <= 100000 * 10**18) {
            return 0.00001 * 10**18;
        } else {
            return 0.000001 * 10**18;
        }
    }

    function _getInflationIndex(
        uint256 effectiveAmount,
        uint256 inflationIndex,
        uint256 blockDelta
    ) private view returns (uint256) {
        return blockDelta * inflationPerBlock(effectiveAmount).wadDiv(effectiveAmount) + inflationIndex;
    }

    function _getRewardsMultiplier(
        uint256 userStaked,
        uint256 lockedStake,
        uint256 totalFrozen_,
        bool isMember_
    ) private pure returns (uint256) {
        if (isMember_) {
            if (userStaked == 0 || totalFrozen_ >= lockedStake || totalFrozen_ >= userStaked) {
                return memberRatio;
            }

            uint256 effectiveLockedAmount = lockedStake - totalFrozen_;
            uint256 effectiveStakeAmount = userStaked - totalFrozen_;

            uint256 lendingRatio = effectiveLockedAmount.wadDiv(effectiveStakeAmount);

            return lendingRatio + memberRatio;
        } else {
            return nonMemberRatio;
        }
    }
}
