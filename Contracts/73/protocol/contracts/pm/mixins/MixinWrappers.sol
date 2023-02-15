pragma solidity ^0.5.11;
// solium-disable-next-line
pragma experimental ABIEncoderV2;

import "./interfaces/MTicketBrokerCore.sol";
import "./interfaces/MContractRegistry.sol";

contract MixinWrappers is MContractRegistry, MTicketBrokerCore {
    /**
     * @notice Redeems multiple winning tickets. The function will redeem all of the provided tickets and handle any failures gracefully without reverting the entire function
     * @param _tickets Array of winning tickets to be redeemed in order to claim payment
     * @param _sigs Array of sender signatures over the hash of tickets (`_sigs[i]` corresponds to `_tickets[i]`)
     * @param _recipientRands Array of preimages for the recipientRandHash included in each ticket (`_recipientRands[i]` corresponds to `_tickets[i]`)
     */
    function batchRedeemWinningTickets(
        Ticket[] memory _tickets,
        bytes[] memory _sigs,
        uint256[] memory _recipientRands
    ) public whenSystemNotPaused currentRoundInitialized {
        for (uint256 i = 0; i < _tickets.length; i++) {
            redeemWinningTicketNoRevert(_tickets[i], _sigs[i], _recipientRands[i]);
        }
    }

    /**
     * @dev Redeems a winning ticket that has been signed by a sender and reveals the
     recipient recipientRand that corresponds to the recipientRandHash included in the ticket
     This function wraps `redeemWinningTicket()` and returns false if the underlying call reverts
     * @param _ticket Winning ticket to be redeemed in order to claim payment
     * @param _sig Sender's signature over the hash of `_ticket`
     * @param _recipientRand The preimage for the recipientRandHash included in `_ticket`
     * @return Boolean indicating whether the underlying `redeemWinningTicket()` call succeeded
     */
    function redeemWinningTicketNoRevert(
        Ticket memory _ticket,
        bytes memory _sig,
        uint256 _recipientRand
    ) internal returns (bool success) {
        // ABI encode calldata for `redeemWinningTicket()`
        // A tuple type is used to represent the Ticket struct in the function signature
        bytes memory redeemWinningTicketCalldata = abi.encodeWithSignature(
            "redeemWinningTicket((address,address,uint256,uint256,uint256,bytes32,bytes),bytes,uint256)",
            _ticket,
            _sig,
            _recipientRand
        );

        // Call `redeemWinningTicket()`
        // solium-disable-next-line
        (success, ) = address(this).call(redeemWinningTicketCalldata);
    }
}
