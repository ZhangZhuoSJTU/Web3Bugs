// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "./PrizeSplit.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPrizePool.sol";

/**
  * @title  PoolTogether V4 PrizeSplitStrategy
  * @author PoolTogether Inc Team
  * @notice Captures PrizePool interest for PrizeReserve and additional PrizeSplit recipients.
            The PrizeSplitStrategy will have at minimum a single PrizeSplit with 100% of the captured
            interest transfered to the PrizeReserve. Additional PrizeSplits can be added, depending on
            the deployers requirements (i.e. percentage to charity). In contrast to previous PoolTogether
            iterations, interest can be captured independent of a new Draw. Ideally (to save gas) interest
            is only captured when also distributing the captured prize(s) to applicable Prize Distributor(s).
*/
contract PrizeSplitStrategy is PrizeSplit, IStrategy {
    /**
     * @notice PrizePool address
     */
    IPrizePool internal immutable prizePool;

    /**
     * @notice Deployed Event
     * @param owner Contract owner
     * @param prizePool Linked PrizePool contract
     */
    event Deployed(address indexed owner, IPrizePool prizePool);

    /* ============ Constructor ============ */

    /**
     * @notice Deploy the PrizeSplitStrategy smart contract.
     * @param _owner     Owner address
     * @param _prizePool PrizePool address
     */
    constructor(address _owner, IPrizePool _prizePool) Ownable(_owner) {
        require(
            address(_prizePool) != address(0),
            "PrizeSplitStrategy/prize-pool-not-zero-address"
        );
        prizePool = _prizePool;
        emit Deployed(_owner, _prizePool);
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IStrategy
    function distribute() external override returns (uint256) {
        uint256 prize = prizePool.captureAwardBalance();

        if (prize == 0) return 0;

        uint256 prizeRemaining = _distributePrizeSplits(prize);

        emit Distributed(prize - prizeRemaining);

        return prize;
    }

    /// @inheritdoc IPrizeSplit
    function getPrizePool() external view override returns (IPrizePool) {
        return prizePool;
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Award ticket tokens to prize split recipient.
     * @dev Award ticket tokens to prize split recipient via the linked PrizePool contract.
     * @param _to Recipient of minted tokens.
     * @param _amount Amount of minted tokens.
     */
    function _awardPrizeSplitAmount(address _to, uint256 _amount) internal override {
        IControlledToken _ticket = prizePool.getTicket();
        prizePool.award(_to, _amount);
        emit PrizeSplitAwarded(_to, _amount, _ticket);
    }
}
