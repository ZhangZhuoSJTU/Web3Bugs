// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.12;

import './NFTLoanTicket.sol';
import {NFTLoanFacilitator} from './NFTLoanFacilitator.sol';
import {NFTLoansTicketDescriptor} from './descriptors/NFTLoansTicketDescriptor.sol';

contract BorrowTicket is NFTLoanTicket {

    /// See NFTLoanTicket
    constructor(
        NFTLoanFacilitator _nftLoanFacilitator,
        NFTLoansTicketDescriptor _descriptor
    ) 
        NFTLoanTicket("Borrow Ticket", "BRWT", _nftLoanFacilitator, _descriptor)
    {}
}