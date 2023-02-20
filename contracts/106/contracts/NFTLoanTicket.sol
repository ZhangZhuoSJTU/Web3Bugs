// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.12;

import {ERC721} from "@rari-capital/solmate/src/tokens/ERC721.sol";

import {NFTLoanFacilitator} from './NFTLoanFacilitator.sol';
import {NFTLoansTicketDescriptor} from './descriptors/NFTLoansTicketDescriptor.sol';
import {IERC721Mintable} from './interfaces/IERC721Mintable.sol';

contract NFTLoanTicket is ERC721, IERC721Mintable {
    NFTLoanFacilitator public immutable nftLoanFacilitator;
    NFTLoansTicketDescriptor public immutable descriptor;

    modifier loanFacilitatorOnly() { 
        require(msg.sender == address(nftLoanFacilitator), "NFTLoanTicket: only loan facilitator");
        _; 
    }

    /// @dev Sets the values for {name} and {symbol} and {nftLoanFacilitator} and {descriptor}.
    constructor(
        string memory name, 
        string memory symbol, 
        NFTLoanFacilitator _nftLoanFacilitator, 
        NFTLoansTicketDescriptor _descriptor
    ) 
        ERC721(name, symbol) 
    {
        nftLoanFacilitator = _nftLoanFacilitator;
        descriptor = _descriptor;
    }

    /// See {IERC721Mintable-mint}.
    function mint(address to, uint256 tokenId) external override loanFacilitatorOnly {
        _mint(to, tokenId);
    }

    /// @notice returns a base64 encoded data uri containing the token metadata in JSON format
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return descriptor.uri(nftLoanFacilitator, tokenId);
    }
}