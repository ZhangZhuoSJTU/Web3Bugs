// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.12;

import {ILendTicket} from './interfaces/ILendTicket.sol';
import {NFTLoanTicket} from './NFTLoanTicket.sol';
import {NFTLoanFacilitator} from './NFTLoanFacilitator.sol';
import {NFTLoansTicketDescriptor} from './descriptors/NFTLoansTicketDescriptor.sol';

contract LendTicket is NFTLoanTicket, ILendTicket {

    /// See NFTLoanTicket
    constructor(
        NFTLoanFacilitator _nftLoanFacilitator,
        NFTLoansTicketDescriptor _descriptor
    ) 
        NFTLoanTicket("Lend Ticket", "LNDT", _nftLoanFacilitator, _descriptor) 
    {}

    /// See {ILendTicket-loanFacilitatorTransfer}
    function loanFacilitatorTransfer(address from, address to, uint256 loanId) external override loanFacilitatorOnly {
        _transfer(from, to, loanId);
    }

    /// @dev exact copy of 
    /// https://github.com/Rari-Capital/solmate/blob/main/src/tokens/ERC721.sol#L69-L96
    /// with L78 - L81 removed to enable loanFacilitatorTransfer
    function _transfer(
        address from,
        address to,
        uint256 id
    ) internal {
        require(from == ownerOf[id], "WRONG_FROM");

        require(to != address(0), "INVALID_RECIPIENT");

        // Underflow of the sender's balance is impossible because we check for
        // ownership above and the recipient's balance can't realistically overflow.
        unchecked {
            balanceOf[from]--;

            balanceOf[to]++;
        }

        ownerOf[id] = to;

        delete getApproved[id];

        emit Transfer(from, to, id);
    }
}