// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import "../../interfaces/IConcentratedLiquidityPool.sol";
import "./ConcentratedLiquidityPosition.sol";

/// @notice Trident Concentrated Liquidity Pool periphery contract that combines non-fungible position management and staking.
contract ConcentratedLiquidityPoolManager is ConcentratedLiquidityPosition {
    event AddIncentive(IConcentratedLiquidityPool indexed pool, Incentive indexed incentive);
    event ReclaimIncentive(IConcentratedLiquidityPool indexed pool, uint256 indexed incentiveId);
    event Subscribe(uint256 indexed positionId, uint256 indexed incentiveId);
    event ClaimReward(uint256 indexed positionId, uint256 indexed incentiveId, address indexed recipient);

    struct Incentive {
        address owner;
        address token;
        uint256 rewardsUnclaimed;
        uint160 secondsClaimed; // @dev x128.
        uint32 startTime;
        uint32 endTime;
        uint32 expiry;
    }

    struct Stake {
        uint160 secondsInsideLast; // @dev x128.
        bool initialized;
    }

    mapping(IConcentratedLiquidityPool => uint256) public incentiveCount;
    mapping(IConcentratedLiquidityPool => mapping(uint256 => Incentive)) public incentives;
    mapping(uint256 => mapping(uint256 => Stake)) public stakes;

    constructor(address wETH, address _masterDeployer) ConcentratedLiquidityPosition(wETH, _masterDeployer) {}

    function addIncentive(IConcentratedLiquidityPool pool, Incentive memory incentive) public {
        uint32 current = uint32(block.timestamp);
        require(current <= incentive.startTime, "ALREADY_STARTED");
        require(current <= incentive.endTime, "ALREADY_ENDED");
        require(incentive.startTime < incentive.endTime, "START_PAST_END");
        require(incentive.endTime + 5 weeks < incentive.expiry, "END_PAST_BUFFER");
        require(incentive.rewardsUnclaimed != 0, "NO_REWARDS");
        incentives[pool][incentiveCount[pool]++] = incentive;
        _transfer(incentive.token, msg.sender, address(this), incentive.rewardsUnclaimed, false);
        emit AddIncentive(pool, incentive);
    }

    /// @dev Withdraws any unclaimed incentive rewards.
    function reclaimIncentive(
        IConcentratedLiquidityPool pool,
        uint256 incentiveId,
        uint256 amount,
        address receiver,
        bool unwrapBento
    ) public {
        Incentive storage incentive = incentives[pool][incentiveId];
        require(incentive.owner == msg.sender, "NOT_OWNER");
        require(incentive.expiry < block.timestamp, "EXPIRED");
        require(incentive.rewardsUnclaimed >= amount, "ALREADY_CLAIMED");
        _transfer(incentive.token, address(this), receiver, amount, unwrapBento);
        emit ReclaimIncentive(pool, incentiveId);
    }

    /// @dev Subscribes a non-fungible position token to an incentive.
    function subscribe(uint256 positionId, uint256 incentiveId) public {
        Position memory position = positions[positionId];
        IConcentratedLiquidityPool pool = position.pool;
        Incentive memory incentive = incentives[pool][positionId];
        Stake storage stake = stakes[positionId][incentiveId];
        require(position.liquidity != 0, "INACTIVE");
        require(stake.secondsInsideLast == 0, "SUBSCRIBED");
        require(incentiveId <= incentiveCount[pool], "NOT_INCENTIVE");
        require(block.timestamp > incentive.startTime && block.timestamp < incentive.endTime, "TIMED_OUT");
        stakes[positionId][incentiveId] = Stake(uint160(pool.rangeSecondsInside(position.lower, position.upper)), true);
        emit Subscribe(positionId, incentiveId);
    }

    function claimReward(
        uint256 positionId,
        uint256 incentiveId,
        address recipient,
        bool unwrapBento
    ) public {
        require(ownerOf[positionId] == msg.sender, "OWNER");
        Position memory position = positions[positionId];
        IConcentratedLiquidityPool pool = position.pool;
        Incentive storage incentive = incentives[position.pool][positionId];
        Stake storage stake = stakes[positionId][incentiveId];
        require(stake.initialized, "UNINITIALIZED");
        uint256 secondsPerLiquidityInside = pool.rangeSecondsInside(position.lower, position.upper) - stake.secondsInsideLast;
        uint256 secondsInside = secondsPerLiquidityInside * position.liquidity;
        uint256 maxTime = incentive.endTime < block.timestamp ? block.timestamp : incentive.endTime;
        uint256 secondsUnclaimed = (maxTime - incentive.startTime) << (128 - incentive.secondsClaimed);
        uint256 rewards = (incentive.rewardsUnclaimed * secondsInside) / secondsUnclaimed;
        incentive.rewardsUnclaimed -= rewards;
        incentive.secondsClaimed += uint160(secondsInside);
        stake.secondsInsideLast += uint160(secondsPerLiquidityInside);
        _transfer(incentive.token, address(this), recipient, rewards, unwrapBento);
        emit ClaimReward(positionId, incentiveId, recipient);
    }

    function getReward(uint256 positionId, uint256 incentiveId) public view returns (uint256 rewards, uint256 secondsInside) {
        Position memory position = positions[positionId];
        IConcentratedLiquidityPool pool = position.pool;
        Incentive memory incentive = incentives[pool][positionId];
        Stake memory stake = stakes[positionId][incentiveId];
        if (stake.initialized) {
            secondsInside = (pool.rangeSecondsInside(position.lower, position.upper) - stake.secondsInsideLast) * position.liquidity;
            uint256 maxTime = incentive.endTime < block.timestamp ? block.timestamp : incentive.endTime;
            uint256 secondsUnclaimed = (maxTime - incentive.startTime) << (128 - incentive.secondsClaimed);
            rewards = (incentive.rewardsUnclaimed * secondsInside) / secondsUnclaimed;
        }
    }
}
