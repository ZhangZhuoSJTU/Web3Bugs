// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/ProposalFactoryLike.sol";

/**
* @author Justin Goro
* @notice This is the only mandatory proposal and is whitelisted at deployment time for LimboDAO. All subsequent proposals are whitelisted by this proposal.
*/
contract ToggleWhitelistProposalProposal is Proposal {
    struct Parameters {
        address proposalFactory;
        address toggleContract;
    }

    Parameters params;

    constructor(address dao, string memory _description)
        Proposal(dao, description){
    }

    function parameterize(address proposalFactory, address toggleContract)
        public
        notCurrent
    {
        params.proposalFactory = proposalFactory;
        params.toggleContract = toggleContract;
    }

    function execute() internal override returns (bool) {
        ProposalFactoryLike(params.proposalFactory).toggleWhitelistProposal(
            params.toggleContract
        );
        return true;
    }
}
