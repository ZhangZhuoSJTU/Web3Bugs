// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface ILendTicket {
    /**
     * @notice Transfers a lend ticket
     * @dev can only be called by nft loan facilitator
     * @param from The current holder of the lend ticket
     * @param to Address to send the lend ticket to
     * @param loanId The lend ticket token id, which is also the loan id in the facilitator contract
     */
    function loanFacilitatorTransfer(address from, address to, uint256 loanId) external;
}