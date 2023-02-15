// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

abstract contract ProposalFactoryLike {
     function toggleWhitelistProposal(address proposal) public virtual;
     function soulUpdateProposal () public  virtual view returns (address); 
}