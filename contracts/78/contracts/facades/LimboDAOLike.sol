// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

abstract contract LimboDAOLike {
    function approveFlanMintingPower(address minter, bool enabled)
        public
        virtual;

    function makeProposal(address proposal, address proposer) public virtual;

    function currentProposalState() public view virtual returns (uint,uint,address,uint,address);

    function setProposalConfig(
        uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory
    ) public virtual;

    function setApprovedAsset(address asset, bool approved) public virtual;

    function successfulProposal(address proposal)
        public
        view
        virtual
        returns (bool);

    function domainConfig()
        public
        virtual
        returns (
            address,
            address,
            address,
            address,
            bool,
            address,
            address
        );

    function getFlashGoverner() external view virtual returns (address);

    function proposalConfig() public virtual view returns (uint,uint,address);

  function setFateToFlan(uint256 rate) public virtual;
}
