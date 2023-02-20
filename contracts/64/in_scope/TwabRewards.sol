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
 */
contract TwabRewards is ITwabRewards {
    using SafeERC20 for IERC20;

    /* ============ Global Variables ============ */

    /// @notice Settings of each promotion.
    mapping(uint256 => Promotion) internal _promotions;

    /// @notice Latest recorded promotion id.
    /// @dev Starts at 0 and is incremented by 1 for each new promotion. So the first promotion will have id 1, the second 2, etc.
    uint256 internal _latestPromotionId;

    /// @notice Keeps track of claimed rewards per user.
    /// @dev _claimedEpochs[promotionId][user] => claimedEpochs
    /// @dev We pack epochs claimed by a user into a uint256. So we can't store more than 255 epochs.
    mapping(uint256 => mapping(address => uint256)) internal _claimedEpochs;

    /* ============ Events ============ */

    /**
        @notice Emitted when a promotion is created.
        @param promotionId Id of the newly created promotion
    */
    event PromotionCreated(uint256 indexed promotionId);

    /**
        @notice Emitted when a promotion is cancelled.
        @param promotionId Id of the promotion being cancelled
        @param amount Amount of tokens transferred to the promotion creator
    */
    event PromotionCancelled(uint256 indexed promotionId, uint256 amount);

    /**
        @notice Emitted when a promotion is extended.
        @param promotionId Id of the promotion being extended
        @param numberOfEpochs Number of epochs the promotion has been extended by
    */
    event PromotionExtended(uint256 indexed promotionId, uint256 numberOfEpochs);

    /**
        @notice Emitted when rewards have been claimed.
        @param promotionId Id of the promotion for which epoch rewards were claimed
        @param epochIds Ids of the epochs being claimed
        @param user Address of the user for which the rewards were claimed
        @param amount Amount of tokens transferred to the recipient address
    */
    event RewardsClaimed(
        uint256 indexed promotionId,
        uint256[] epochIds,
        address indexed user,
        uint256 amount
    );

    /* ============ Modifiers ============ */

    /// @dev Ensure that the caller is the creator of the promotion.
    /// @param _promotionId Id of the promotion to check
    modifier onlyPromotionCreator(uint256 _promotionId) {
        require(
            msg.sender == _getPromotion(_promotionId).creator,
            "TwabRewards/only-promotion-creator"
        );
        _;
    }

    /* ============ External Functions ============ */

    /// @inheritdoc ITwabRewards
    function createPromotion(
        address _ticket,
        IERC20 _token,
        uint216 _tokensPerEpoch,
        uint32 _startTimestamp,
        uint32 _epochDuration,
        uint8 _numberOfEpochs
    ) external override returns (uint256) {
        _requireTicket(_ticket);

        uint256 _nextPromotionId = _latestPromotionId + 1;
        _latestPromotionId = _nextPromotionId;

        _promotions[_nextPromotionId] = Promotion(
            msg.sender,
            _ticket,
            _token,
            _tokensPerEpoch,
            _startTimestamp,
            _epochDuration,
            _numberOfEpochs
        );

        _token.safeTransferFrom(msg.sender, address(this), _tokensPerEpoch * _numberOfEpochs);

        emit PromotionCreated(_nextPromotionId);

        return _nextPromotionId;
    }

    /// @inheritdoc ITwabRewards
    function cancelPromotion(uint256 _promotionId, address _to)
        external
        override
        onlyPromotionCreator(_promotionId)
        returns (bool)
    {
        Promotion memory _promotion = _getPromotion(_promotionId);

        _requirePromotionActive(_promotion);
        require(_to != address(0), "TwabRewards/recipient-not-zero-address");

        uint256 _remainingRewards = _getRemainingRewards(_promotion);

        delete _promotions[_promotionId];
        _promotion.token.safeTransfer(_to, _remainingRewards);

        emit PromotionCancelled(_promotionId, _remainingRewards);

        return true;
    }

    /// @inheritdoc ITwabRewards
    function extendPromotion(uint256 _promotionId, uint8 _numberOfEpochs)
        external
        override
        returns (bool)
    {
        Promotion memory _promotion = _getPromotion(_promotionId);

        _requirePromotionActive(_promotion);

        uint8 _extendedNumberOfEpochs = _promotion.numberOfEpochs + _numberOfEpochs;
        _promotions[_promotionId].numberOfEpochs = _extendedNumberOfEpochs;

        uint256 _amount = _numberOfEpochs * _promotion.tokensPerEpoch;
        _promotion.token.safeTransferFrom(msg.sender, address(this), _amount);

        emit PromotionExtended(_promotionId, _numberOfEpochs);

        return true;
    }

    /// @inheritdoc ITwabRewards
    function claimRewards(
        address _user,
        uint256 _promotionId,
        uint256[] calldata _epochIds
    ) external override returns (uint256) {
        Promotion memory _promotion = _getPromotion(_promotionId);

        uint256 _rewardsAmount;
        uint256 _userClaimedEpochs = _claimedEpochs[_promotionId][_user];

        for (uint256 index = 0; index < _epochIds.length; index++) {
            uint256 _epochId = _epochIds[index];

            require(
                !_isClaimedEpoch(_userClaimedEpochs, _epochId),
                "TwabRewards/rewards-already-claimed"
            );

            _rewardsAmount += _calculateRewardAmount(_user, _promotion, _epochId);
            _userClaimedEpochs = _updateClaimedEpoch(_userClaimedEpochs, _epochId);
        }

        _claimedEpochs[_promotionId][_user] = _userClaimedEpochs;

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
        uint256[] calldata _epochIds
    ) external view override returns (uint256[] memory) {
        Promotion memory _promotion = _getPromotion(_promotionId);
        uint256[] memory _rewardsAmount = new uint256[](_epochIds.length);

        for (uint256 index = 0; index < _epochIds.length; index++) {
            _rewardsAmount[index] = _calculateRewardAmount(_user, _promotion, _epochIds[index]);
        }

        return _rewardsAmount;
    }

    /* ============ Internal Functions ============ */

    /**
    @notice Determine if address passed is actually a ticket.
    @param _ticket Address to check
   */
    function _requireTicket(address _ticket) internal view {
        require(_ticket != address(0), "TwabRewards/ticket-not-zero-address");

        (bool succeeded, bytes memory data) = address(_ticket).staticcall(
            abi.encodePacked(ITicket(_ticket).controller.selector)
        );

        address controllerAddress;

        if (data.length > 0) {
            controllerAddress = abi.decode(data, (address));
        }

        require(succeeded && controllerAddress != address(0), "TwabRewards/invalid-ticket");
    }

    /**
        @notice Determine if a promotion is active.
        @param _promotion Promotion to check
    */
    function _requirePromotionActive(Promotion memory _promotion) internal view {
        uint256 _promotionEndTimestamp = _promotion.startTimestamp +
            (_promotion.epochDuration * _promotion.numberOfEpochs);

        require(
            _promotionEndTimestamp > 0 && _promotionEndTimestamp >= block.timestamp,
            "TwabRewards/promotion-not-active"
        );
    }

    /**
        @notice Get settings for a specific promotion.
        @dev Will revert if the promotion does not exist.
        @param _promotionId Promotion id to get settings for
        @return Promotion settings
     */
    function _getPromotion(uint256 _promotionId) internal view returns (Promotion memory) {
        return _promotions[_promotionId];
    }

    /**
        @notice Get the current epoch id of a promotion.
        @dev Epoch ids and their boolean values are tightly packed and stored in a uint256, so epoch id starts at 0.
        @param _promotion Promotion to get current epoch for
        @return Epoch id
     */
    function _getCurrentEpochId(Promotion memory _promotion) internal view returns (uint256) {
        // elapsedTimestamp / epochDurationTimestamp
        return (block.timestamp - _promotion.startTimestamp) / _promotion.epochDuration;
    }

    /**
        @notice Get reward amount for a specific user.
        @dev Rewards can only be claimed once the epoch is over.
        @param _user User to get reward amount for
        @param _promotion Promotion from which the epoch is
        @param _epochId Epoch id to get reward amount for
        @return Reward amount
     */
    function _calculateRewardAmount(
        address _user,
        Promotion memory _promotion,
        uint256 _epochId
    ) internal view returns (uint256) {
        uint256 _epochDuration = _promotion.epochDuration;
        uint256 _epochStartTimestamp = _promotion.startTimestamp + (_epochDuration * _epochId);
        uint256 _epochEndTimestamp = _epochStartTimestamp + _epochDuration;

        require(block.timestamp > _epochEndTimestamp, "TwabRewards/epoch-not-over");

        ITicket _ticket = ITicket(_promotion.ticket);

        uint256 _averageBalance = _ticket.getAverageBalanceBetween(
            _user,
            uint64(_epochStartTimestamp),
            uint64(_epochEndTimestamp)
        );

        uint64[] memory _epochStartTimestamps = new uint64[](1);
        _epochStartTimestamps[0] = uint64(_epochStartTimestamp);

        uint64[] memory _epochEndTimestamps = new uint64[](1);
        _epochEndTimestamps[0] = uint64(_epochEndTimestamp);

        uint256[] memory _averageTotalSupplies = _ticket.getAverageTotalSuppliesBetween(
            _epochStartTimestamps,
            _epochEndTimestamps
        );

        if (_averageTotalSupplies[0] > 0) {
            return (_promotion.tokensPerEpoch * _averageBalance) / _averageTotalSupplies[0];
        }

        return 0;
    }

    /**
        @notice Get the total amount of tokens left to be rewarded.
        @param _promotion Promotion to get the total amount of tokens left to be rewarded for
        @return Amount of tokens left to be rewarded
     */
    function _getRemainingRewards(Promotion memory _promotion) internal view returns (uint256) {
        // _tokensPerEpoch * _numberOfEpochsLeft
        return
            _promotion.tokensPerEpoch *
            (_promotion.numberOfEpochs - _getCurrentEpochId(_promotion));
    }

    /**
        @notice Set boolean value for a specific epoch.
        @dev Bits are stored in a uint256 from right to left.
        Let's take the example of the following 8 bits word. 0110 0011
        To set the boolean value to 1 for the epoch id 2, we need to create a mask by shifting 1 to the left by 2 bits.
        We get: 0000 0001 << 2 = 0000 0100
        We then OR the mask with the word to set the value.
        We get: 0110 0011 | 0000 0100 = 0110 0111
        @param _userClaimedEpochs Tightly packed epoch ids with their boolean values
        @param _epochId Id of the epoch to set the boolean for
        @return Tightly packed epoch ids with the newly boolean value set
    */
    function _updateClaimedEpoch(uint256 _userClaimedEpochs, uint256 _epochId)
        internal
        pure
        returns (uint256)
    {
        return _userClaimedEpochs | (uint256(1) << _epochId);
    }

    /**
        @notice Check if rewards of an epoch for a given promotion have already been claimed by the user.
        @dev Bits are stored in a uint256 from right to left.
        Let's take the example of the following 8 bits word. 0110 0111
        To retrieve the boolean value for the epoch id 2, we need to shift the word to the right by 2 bits.
        We get: 0110 0111 >> 2 = 0001 1001
        We then get the value of the last bit by masking with 1.
        We get: 0001 1001 & 0000 0001 = 0000 0001 = 1
        We then return the boolean value true since the last bit is 1.
        @param _userClaimedEpochs Record of epochs already claimed by the user
        @param _epochId Epoch id to check
        @return true if the rewards have already been claimed for the given epoch, false otherwise
     */
    function _isClaimedEpoch(uint256 _userClaimedEpochs, uint256 _epochId)
        internal
        pure
        returns (bool)
    {
        return (_userClaimedEpochs >> _epochId) & uint256(1) == 1;
    }
}
