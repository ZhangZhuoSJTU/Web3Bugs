// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import './NFTLoansTicketDescriptor.sol';

contract BorrowTicketDescriptor is NFTLoansTicketDescriptor {
    /// @dev see NFTLoansTicketDescriptor
    constructor(ITicketTypeSpecificSVGHelper _svgHelper) NFTLoansTicketDescriptor("Borrow", _svgHelper) {}

    /**
     * @notice returns string with borrow ticket description details
     * @dev Called by generateDescriptor when populating the description part of the token metadata. 
     */
    function generateDescription(string memory) internal pure override returns (string memory) {
        return 'This Borrow Ticket NFT was created by the deposit of an NFT into the NFT Loan Faciliator '
                'contract to serve as collateral for a loan. If the loan is underwritten, funds will be transferred '
                'to the borrow ticket holder. If the loan is repaid, the NFT collateral is transferred to the borrow '
                'ticket holder. If the loan is marked closed, the collateral has been withdrawn.';
                
    }

}