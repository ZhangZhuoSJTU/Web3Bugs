pragma solidity ^0.5.11;
// solium-disable-next-line
pragma experimental ABIEncoderV2;

import "./interfaces/MReserve.sol";
import "./interfaces/MContractRegistry.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MixinReserve is MContractRegistry, MReserve {
    using SafeMath for uint256;

    struct Reserve {
        uint256 funds; // Amount of funds in the reserve
        mapping(uint256 => uint256) claimedForRound; // Mapping of round => total amount claimed
        mapping(uint256 => mapping(address => uint256)) claimedByAddress; // Mapping of round => claimant address => amount claimed
    }

    // Mapping of address => reserve
    mapping(address => Reserve) internal reserves;

    /**
     * @dev Returns info about a reserve
     * @param _reserveHolder Address of reserve holder
     * @return Info about the reserve for `_reserveHolder`
     */
    function getReserveInfo(address _reserveHolder) public view returns (ReserveInfo memory info) {
        info.fundsRemaining = remainingReserve(_reserveHolder);
        info.claimedInCurrentRound = reserves[_reserveHolder].claimedForRound[roundsManager().currentRound()];
    }

    /**
     * @dev Returns the amount of funds claimable by a claimant from a reserve in the current round
     * @param _reserveHolder Address of reserve holder
     * @param _claimant Address of claimant
     * @return Amount of funds claimable by `_claimant` from the reserve for `_reserveHolder` in the current round
     */
    function claimableReserve(address _reserveHolder, address _claimant) public view returns (uint256) {
        Reserve storage reserve = reserves[_reserveHolder];

        uint256 currentRound = roundsManager().currentRound();

        if (!bondingManager().isActiveTranscoder(_claimant)) {
            return 0;
        }

        uint256 poolSize = bondingManager().getTranscoderPoolSize();
        if (poolSize == 0) {
            return 0;
        }

        // Total claimable funds = remaining funds + amount claimed for the round
        uint256 totalClaimable = reserve.funds.add(reserve.claimedForRound[currentRound]);
        return totalClaimable.div(poolSize).sub(reserve.claimedByAddress[currentRound][_claimant]);
    }

    /**
     * @dev Returns the amount of funds claimed by a claimant from a reserve in the current round
     * @param _reserveHolder Address of reserve holder
     * @param _claimant Address of claimant
     * @return Amount of funds claimed by `_claimant` from the reserve for `_reserveHolder` in the current round
     */
    function claimedReserve(address _reserveHolder, address _claimant) public view returns (uint256) {
        Reserve storage reserve = reserves[_reserveHolder];
        uint256 currentRound = roundsManager().currentRound();
        return reserve.claimedByAddress[currentRound][_claimant];
    }

    /**
     * @dev Adds funds to a reserve
     * @param _reserveHolder Address of reserve holder
     * @param _amount Amount of funds to add to reserve
     */
    function addReserve(address _reserveHolder, uint256 _amount) internal {
        reserves[_reserveHolder].funds = reserves[_reserveHolder].funds.add(_amount);

        emit ReserveFunded(_reserveHolder, _amount);
    }

    /**
     * @dev Clears contract storage used for a reserve
     * @param _reserveHolder Address of reserve holder
     */
    function clearReserve(address _reserveHolder) internal {
        // This delete operation will only clear reserve.funds and will not clear the storage for reserve.claimedForRound
        // reserve.claimedByAddress because these fields are mappings and the Solidity `delete` keyword will not modify mappings.
        // This *could* be a problem in the following scenario:
        //
        // 1) In round N, for address A, reserve.claimedForRound[N] > 0 and reserve.claimedByAddress[N][r_i] > 0 where r_i is
        // a member of the active set in round N
        // 2) This function is called by MixinTicketBrokerCore.withdraw() in round N
        // 3) Address A funds its reserve again
        //
        // After step 3, A has reserve.funds > 0, reserve.claimedForRound[N] > 0 and reserve.claimedByAddress[N][r_i] > 0
        // despite having funded a fresh reserve after previously withdrawing all of its funds in the same round.
        // We prevent this scenario by disallowing reserve claims starting at an address' withdraw round in
        // MixinTicketBrokerCore.redeemWinningTicket()
        delete reserves[_reserveHolder];
    }

    /**
     * @dev Claims funds from a reserve
     * @param _reserveHolder Address of reserve holder
     * @param _claimant Address of claimant
     * @param _amount Amount of funds to claim from the reserve
     * @return Amount of funds (<= `_amount`) claimed by `_claimant` from the reserve for `_reserveHolder`
     */
    function claimFromReserve(
        address _reserveHolder,
        address _claimant,
        uint256 _amount
    ) internal returns (uint256) {
        uint256 claimableFunds = claimableReserve(_reserveHolder, _claimant);
        // If the given amount > claimableFunds then claim claimableFunds
        // If the given amount <= claimableFunds then claim the given amount
        uint256 claimAmount = _amount > claimableFunds ? claimableFunds : _amount;

        if (claimAmount > 0) {
            uint256 currentRound = roundsManager().currentRound();
            Reserve storage reserve = reserves[_reserveHolder];
            // Increase total amount claimed for the round
            reserve.claimedForRound[currentRound] = reserve.claimedForRound[currentRound].add(claimAmount);
            // Increase amount claimed by claimant for the round
            reserve.claimedByAddress[currentRound][_claimant] = reserve.claimedByAddress[currentRound][_claimant].add(
                claimAmount
            );
            // Decrease remaining reserve
            reserve.funds = reserve.funds.sub(claimAmount);

            emit ReserveClaimed(_reserveHolder, _claimant, claimAmount);
        }

        return claimAmount;
    }

    /**
     * @dev Returns the amount of funds remaining in a reserve
     * @param _reserveHolder Address of reserve holder
     * @return Amount of funds remaining in the reserve for `_reserveHolder`
     */
    function remainingReserve(address _reserveHolder) internal view returns (uint256) {
        return reserves[_reserveHolder].funds;
    }
}
