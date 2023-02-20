// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@pooltogether/v4-core/contracts/interfaces/ITicket.sol";

import "./interfaces/ITwabRewards.sol";

/**
 * @title PoolTogether V4 TwabRewards
 * @author PoolTogether Inc Team
 * @notice Contract to distribute rewards to depositors in a pool.
 * This contract supports the creation of several promotions that can run simultaneously.
 * In order to calculate user rewards, we use the TWAB (Time-Weighted Average Balance) from the Ticket contract.
 * This way, users simply need to hold their tickets to be eligible to claim rewards.
 * Rewards are calculated based on the average amount of tickets they hold during the epoch duration.
 * @dev This contract supports only one prize pool ticket.
 * @dev This contract does not support the use of fee on transfer tokens.
 */
contract TwabRewards is ITwabRewards {
    using SafeERC20 for IERC20;

    /* ============ Global Variables ============ */

    /// @notice Prize pool ticket for which the promotions are created.
    ITicket public immutable ticket;

    /// @notice Period during which the promotion owner can't destroy a promotion.
    uint32 public constant GRACE_PERIOD = 60 days;

    /// @notice Settings of each promotion.
    mapping(uint256 => Promotion) internal _promotions;

    /**
     * @notice Latest recorded promotion id.
     * @dev Starts at 0 and is incremented by 1 for each new promotion. So the first promotion will have id 1, the second 2, etc.
     */
    uint256 internal _latestPromotionId;

    /**
     * @notice Keeps track of claimed rewards per user.
     * @dev _claimedEpochs[promotionId][user] => claimedEpochs
     * @dev We pack epochs claimed by a user into a uint256. So we can't store more than 256 epochs.
     */
    mapping(uint256 => mapping(address => uint256)) internal _claimedEpochs;

    /* ============ Events ============ */

    /**
     * @notice Emitted when a promotion is created.
     * @param promotionId Id of the newly created promotion
     */
    event PromotionCreated(uint256 indexed promotionId);

    /**
     * @notice Emitted when a promotion is ended.
     * @param promotionId Id of the promotion being ended
     * @param recipient Address of the recipient that will receive the remaining rewards
     * @param amount Amount of tokens transferred to the recipient
     * @param epochNumber Epoch number at which the promotion ended
     */
    event PromotionEnded(
        uint256 indexed promotionId,
        address indexed recipient,
        uint256 amount,
        uint8 epochNumber
    );

    /**
     * @notice Emitted when a promotion is destroyed.
     * @param promotionId Id of the promotion being destroyed
     * @param recipient Address of the recipient that will receive the unclaimed rewards
     * @param amount Amount of tokens transferred to the recipient
     */
    event PromotionDestroyed(
        uint256 indexed promotionId,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @notice Emitted when a promotion is extended.
     * @param promotionId Id of the promotion being extended
     * @param numberOfEpochs Number of epochs the promotion has been extended by
     */
    event PromotionExtended(uint256 indexed promotionId, uint256 numberOfEpochs);

    /**
     * @notice Emitted when rewards have been claimed.
     * @param promotionId Id of the promotion for which epoch rewards were claimed
     * @param epochIds Ids of the epochs being claimed
     * @param user Address of the user for which the rewards were claimed
     * @param amount Amount of tokens transferred to the recipient address
     */
    event RewardsClaimed(
        uint256 indexed promotionId,
        uint8[] epochIds,
        address indexed user,
        uint256 amount
    );

    /* ============ Constructor ============ */

    /**
     * @notice Constructor of the contract.
     * @param _ticket Prize Pool ticket address for which the promotions will be created
     */
    constructor(ITicket _ticket) {
        _requireTicket(_ticket);
        ticket = _ticket;
    }

    /* ============ External Functions ============ */

    /// @inheritdoc ITwabRewards
    function createPromotion(
        IERC20 _token,
        uint64 _startTimestamp,
        uint256 _tokensPerEpoch,
        uint48 _epochDuration,
        uint8 _numberOfEpochs
    ) external override returns (uint256) {
        require(_tokensPerEpoch > 0, "TwabRewards/tokens-not-zero");
        require(_epochDuration > 0, "TwabRewards/duration-not-zero");
        _requireNumberOfEpochs(_numberOfEpochs);

        uint256 _nextPromotionId = _latestPromotionId + 1;
        _latestPromotionId = _nextPromotionId;

        uint256 _amount = _tokensPerEpoch * _numberOfEpochs;

        _promotions[_nextPromotionId] = Promotion({
            creator: msg.sender,
            startTimestamp: _startTimestamp,
            numberOfEpochs: _numberOfEpochs,
            epochDuration: _epochDuration,
            createdAt: uint48(block.timestamp),
            token: _token,
            tokensPerEpoch: _tokensPerEpoch,
            rewardsUnclaimed: _amount
        });

        uint256 _beforeBalance = _token.balanceOf(address(this));

        _token.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 _afterBalance = _token.balanceOf(address(this));

        require(_beforeBalance + _amount == _afterBalance, "TwabRewards/promo-amount-diff");

        emit PromotionCreated(_nextPromotionId);

        return _nextPromotionId;
    }

    /// @inheritdoc ITwabRewards
    function endPromotion(uint256 _promotionId, address _to) external override returns (bool) {
        require(_to != address(0), "TwabRewards/payee-not-zero-addr");

        Promotion memory _promotion = _getPromotion(_promotionId);
        _requirePromotionCreator(_promotion);
        _requirePromotionActive(_promotion);

        uint8 _epochNumber = uint8(_getCurrentEpochId(_promotion));
        _promotions[_promotionId].numberOfEpochs = _epochNumber;

        uint256 _remainingRewards = _getRemainingRewards(_promotion);
        _promotions[_promotionId].rewardsUnclaimed -= _remainingRewards;

        _promotion.token.safeTransfer(_to, _remainingRewards);

        emit PromotionEnded(_promotionId, _to, _remainingRewards, _epochNumber);

        return true;
    }

    /// @inheritdoc ITwabRewards
    function destroyPromotion(uint256 _promotionId, address _to) external override returns (bool) {
        require(_to != address(0), "TwabRewards/payee-not-zero-addr");

        Promotion memory _promotion = _getPromotion(_promotionId);
        _requirePromotionCreator(_promotion);

        uint256 _promotionEndTimestamp = _getPromotionEndTimestamp(_promotion);
        uint256 _promotionCreatedAt = _promotion.createdAt;

        uint256 _gracePeriodEndTimestamp = (
            _promotionEndTimestamp < _promotionCreatedAt
                ? _promotionCreatedAt
                : _promotionEndTimestamp
        ) + GRACE_PERIOD;

        require(block.timestamp >= _gracePeriodEndTimestamp, "TwabRewards/grace-period-active");

        uint256 _rewardsUnclaimed = _promotion.rewardsUnclaimed;
        delete _promotions[_promotionId];

        _promotion.token.safeTransfer(_to, _rewardsUnclaimed);

        emit PromotionDestroyed(_promotionId, _to, _rewardsUnclaimed);

        return true;
    }

    /// @inheritdoc ITwabRewards
    function extendPromotion(uint256 _promotionId, uint8 _numberOfEpochs)
        external
        override
        returns (bool)
    {
        _requireNumberOfEpochs(_numberOfEpochs);

        Promotion memory _promotion = _getPromotion(_promotionId);
        _requirePromotionActive(_promotion);

        uint8 _currentNumberOfEpochs = _promotion.numberOfEpochs;

        require(
            _numberOfEpochs <= (type(uint8).max - _currentNumberOfEpochs),
            "TwabRewards/epochs-over-limit"
        );

        _promotions[_promotionId].numberOfEpochs = _currentNumberOfEpochs + _numberOfEpochs;

        uint256 _amount = _numberOfEpochs * _promotion.tokensPerEpoch;

        _promotions[_promotionId].rewardsUnclaimed += _amount;
        _promotion.token.safeTransferFrom(msg.sender, address(this), _amount);

        emit PromotionExtended(_promotionId, _numberOfEpochs);

        return true;
    }

    /// @inheritdoc ITwabRewards
    function claimRewards(
        address _user,
        uint256 _promotionId,
        uint8[] calldata _epochIds
    ) external override returns (uint256) {
        Promotion memory _promotion = _getPromotion(_promotionId);

        uint256 _rewardsAmount;
        uint256 _userClaimedEpochs = _claimedEpochs[_promotionId][_user];
        uint256 _epochIdsLength = _epochIds.length;

        for (uint256 index = 0; index < _epochIdsLength; index++) {
            uint8 _epochId = _epochIds[index];

            require(!_isClaimedEpoch(_userClaimedEpochs, _epochId), "TwabRewards/rewards-claimed");

            _rewardsAmount += _calculateRewardAmount(_user, _promotion, _epochId);
            _userClaimedEpochs = _updateClaimedEpoch(_userClaimedEpochs, _epochId);
        }

        _claimedEpochs[_promotionId][_user] = _userClaimedEpochs;
        _promotions[_promotionId].rewardsUnclaimed -= _rewardsAmount;

        _promotion.token.safeTransfer(_user, _rewardsAmount);

        emit RewardsClaimed(_promotionId, _epochIds, _user, _rewardsAmount);

        return _rewardsAmount;
    }

    /// @inheritdoc ITwabRewards
    function getPromotion(uint256 _promotionId) external view override returns (Promotion memory) {
        return _getPromotion(_promotionId);
    }

    /// @inheritdoc ITwabRewards
    function getCurrentEpochId(uint256 _promotionId) external view override returns (uint256) {
        return _getCurrentEpochId(_getPromotion(_promotionId));
    }

    /// @inheritdoc ITwabRewards
    function getRemainingRewards(uint256 _promotionId) external view override returns (uint256) {
        return _getRemainingRewards(_getPromotion(_promotionId));
    }

    /// @inheritdoc ITwabRewards
    function getRewardsAmount(
        address _user,
        uint256 _promotionId,
        uint8[] calldata _epochIds
    ) external view override returns (uint256[] memory) {
        Promotion memory _promotion = _getPromotion(_promotionId);

        uint256 _epochIdsLength = _epochIds.length;
        uint256[] memory _rewardsAmount = new uint256[](_epochIdsLength);

        for (uint256 index = 0; index < _epochIdsLength; index++) {
            if (_isClaimedEpoch(_claimedEpochs[_promotionId][_user], _epochIds[index])) {
                _rewardsAmount[index] = 0;
            } else {
                _rewardsAmount[index] = _calculateRewardAmount(_user, _promotion, _epochIds[index]);
            }
        }

        return _rewardsAmount;
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Determine if address passed is actually a ticket.
     * @param _ticket Address to check
     */
    function _requireTicket(ITicket _ticket) internal view {
        require(address(_ticket) != address(0), "TwabRewards/ticket-not-zero-addr");

        (bool succeeded, bytes memory data) = address(_ticket).staticcall(
            abi.encodePacked(_ticket.controller.selector)
        );

        require(
            succeeded && data.length > 0 && abi.decode(data, (uint160)) != 0,
            "TwabRewards/invalid-ticket"
        );
    }

    /**
     * @notice Allow a promotion to be created or extended only by a positive number of epochs.
     * @param _numberOfEpochs Number of epochs to check
     */
    function _requireNumberOfEpochs(uint8 _numberOfEpochs) internal pure {
        require(_numberOfEpochs > 0, "TwabRewards/epochs-not-zero");
    }

    /**
     * @notice Determine if a promotion is active.
     * @param _promotion Promotion to check
     */
    function _requirePromotionActive(Promotion memory _promotion) internal view {
        require(
            _getPromotionEndTimestamp(_promotion) > block.timestamp,
            "TwabRewards/promotion-inactive"
        );
    }

    /**
     * @notice Determine if msg.sender is the promotion creator.
     * @param _promotion Promotion to check
     */
    function _requirePromotionCreator(Promotion memory _promotion) internal view {
        require(msg.sender == _promotion.creator, "TwabRewards/only-promo-creator");
    }

    /**
     * @notice Get settings for a specific promotion.
     * @dev Will revert if the promotion does not exist.
     * @param _promotionId Promotion id to get settings for
     * @return Promotion settings
     */
    function _getPromotion(uint256 _promotionId) internal view returns (Promotion memory) {
        Promotion memory _promotion = _promotions[_promotionId];
        require(_promotion.creator != address(0), "TwabRewards/invalid-promotion");
        return _promotion;
    }

    /**
     * @notice Compute promotion end timestamp.
     * @param _promotion Promotion to compute end timestamp for
     * @return Promotion end timestamp
     */
    function _getPromotionEndTimestamp(Promotion memory _promotion)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return
                _promotion.startTimestamp + (_promotion.epochDuration * _promotion.numberOfEpochs);
        }
    }

    /**
     * @notice Get the current epoch id of a promotion.
     * @dev Epoch ids and their boolean values are tightly packed and stored in a uint256, so epoch id starts at 0.
     * @dev We return the current epoch id if the promotion has not ended.
     * If the current timestamp is before the promotion start timestamp, we return 0.
     * Otherwise, we return the epoch id at the current timestamp. This could be greater than the number of epochs of the promotion.
     * @param _promotion Promotion to get current epoch for
     * @return Epoch id
     */
    function _getCurrentEpochId(Promotion memory _promotion) internal view returns (uint256) {
        uint256 _currentEpochId;

        if (block.timestamp > _promotion.startTimestamp) {
            unchecked {
                _currentEpochId =
                    (block.timestamp - _promotion.startTimestamp) /
                    _promotion.epochDuration;
            }
        }

        return _currentEpochId;
    }

    /**
     * @notice Get reward amount for a specific user.
     * @dev Rewards can only be calculated once the epoch is over.
     * @dev Will revert if `_epochId` is over the total number of epochs or if epoch is not over.
     * @dev Will return 0 if the user average balance of tickets is 0.
     * @param _user User to get reward amount for
     * @param _promotion Promotion from which the epoch is
     * @param _epochId Epoch id to get reward amount for
     * @return Reward amount
     */
    function _calculateRewardAmount(
        address _user,
        Promotion memory _promotion,
        uint8 _epochId
    ) internal view returns (uint256) {
        uint64 _epochDuration = _promotion.epochDuration;
        uint64 _epochStartTimestamp = _promotion.startTimestamp + (_epochDuration * _epochId);
        uint64 _epochEndTimestamp = _epochStartTimestamp + _epochDuration;

        require(block.timestamp >= _epochEndTimestamp, "TwabRewards/epoch-not-over");
        require(_epochId < _promotion.numberOfEpochs, "TwabRewards/invalid-epoch-id");

        uint256 _averageBalance = ticket.getAverageBalanceBetween(
            _user,
            _epochStartTimestamp,
            _epochEndTimestamp
        );

        if (_averageBalance > 0) {
            uint64[] memory _epochStartTimestamps = new uint64[](1);
            _epochStartTimestamps[0] = _epochStartTimestamp;

            uint64[] memory _epochEndTimestamps = new uint64[](1);
            _epochEndTimestamps[0] = _epochEndTimestamp;

            uint256 _averageTotalSupply = ticket.getAverageTotalSuppliesBetween(
                _epochStartTimestamps,
                _epochEndTimestamps
            )[0];

            return (_promotion.tokensPerEpoch * _averageBalance) / _averageTotalSupply;
        }

        return 0;
    }

    /**
     * @notice Get the total amount of tokens left to be rewarded.
     * @param _promotion Promotion to get the total amount of tokens left to be rewarded for
     * @return Amount of tokens left to be rewarded
     */
    function _getRemainingRewards(Promotion memory _promotion) internal view returns (uint256) {
        if (block.timestamp > _getPromotionEndTimestamp(_promotion)) {
            return 0;
        }

        return
            _promotion.tokensPerEpoch *
            (_promotion.numberOfEpochs - _getCurrentEpochId(_promotion));
    }

    /**
    * @notice Set boolean value for a specific epoch.
    * @dev Bits are stored in a uint256 from right to left.
        Let's take the example of the following 8 bits word. 0110 0011
        To set the boolean value to 1 for the epoch id 2, we need to create a mask by shifting 1 to the left by 2 bits.
        We get: 0000 0001 << 2 = 0000 0100
        We then OR the mask with the word to set the value.
        We get: 0110 0011 | 0000 0100 = 0110 0111
    * @param _userClaimedEpochs Tightly packed epoch ids with their boolean values
    * @param _epochId Id of the epoch to set the boolean for
    * @return Tightly packed epoch ids with the newly boolean value set
    */
    function _updateClaimedEpoch(uint256 _userClaimedEpochs, uint8 _epochId)
        internal
        pure
        returns (uint256)
    {
        return _userClaimedEpochs | (uint256(1) << _epochId);
    }

    /**
    * @notice Check if rewards of an epoch for a given promotion have already been claimed by the user.
    * @dev Bits are stored in a uint256 from right to left.
        Let's take the example of the following 8 bits word. 0110 0111
        To retrieve the boolean value for the epoch id 2, we need to shift the word to the right by 2 bits.
        We get: 0110 0111 >> 2 = 0001 1001
        We then get the value of the last bit by masking with 1.
        We get: 0001 1001 & 0000 0001 = 0000 0001 = 1
        We then return the boolean value true since the last bit is 1.
    * @param _userClaimedEpochs Record of epochs already claimed by the user
    * @param _epochId Epoch id to check
    * @return true if the rewards have already been claimed for the given epoch, false otherwise
     */
    function _isClaimedEpoch(uint256 _userClaimedEpochs, uint8 _epochId)
        internal
        pure
        returns (bool)
    {
        return (_userClaimedEpochs >> _epochId) & uint256(1) == 1;
    }
}
