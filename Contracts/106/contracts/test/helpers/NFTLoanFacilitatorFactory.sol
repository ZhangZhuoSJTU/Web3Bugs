// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {NFTLoanFacilitator} from 'contracts/NFTLoanFacilitator.sol';
import {BorrowTicket} from 'contracts/BorrowTicket.sol';
import {LendTicket} from 'contracts/LendTicket.sol';
import {BorrowTicketDescriptor} from 'contracts/descriptors/BorrowTicketDescriptor.sol';
import {LendTicketDescriptor} from 'contracts/descriptors/LendTicketDescriptor.sol';
import {LendTicketSVGHelper} from 'contracts/descriptors/LendTicketSVGHelper.sol';
import {BorrowTicketSVGHelper} from 'contracts/descriptors/BorrowTicketSVGHelper.sol';

interface Vm {
    function startPrank(address account) external;
    function stopPrank() external;
}

contract NFTLoanFacilitatorFactory {
    Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function newFacilitator(address manager)
        public 
        returns (
            BorrowTicket borrowTicket,
            LendTicket lendTicket,
            NFTLoanFacilitator facilitator
        )
    {
        BorrowTicketSVGHelper bs = new BorrowTicketSVGHelper();
        BorrowTicketDescriptor bd = new BorrowTicketDescriptor(bs);

        LendTicketSVGHelper ls = new LendTicketSVGHelper();
        LendTicketDescriptor ld = new LendTicketDescriptor(ls);

        facilitator = new NFTLoanFacilitator(manager);
        borrowTicket = new BorrowTicket(facilitator, bd);
        lendTicket = new LendTicket(facilitator, ld);
        vm.startPrank(manager);
        facilitator.setBorrowTicketContract(address(borrowTicket));
        facilitator.setLendTicketContract(address(lendTicket));
        vm.stopPrank();
    }
}