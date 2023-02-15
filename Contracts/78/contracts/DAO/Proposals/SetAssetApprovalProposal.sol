// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";

/**
* @author Justin Goro
* @notice EYE and EYE based assets can be used to earn fate. This proposal determines which tokens fall into the latter category.
*/
contract SetAssetApprovalProposal is Proposal {
    struct Parameters {
        address asset;
        bool approved;
    }

    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    function parameterize(address asset, bool approved) public notCurrent {
        params.asset = asset;
        params.approved = approved;
    }

    function execute() internal override returns (bool) {
        DAO.setApprovedAsset(params.asset, params.approved);
        return true;
    }
}
