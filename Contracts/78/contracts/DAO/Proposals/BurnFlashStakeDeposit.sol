// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/FlashGovernanceArbiterLike.sol";

/**
* @author Justin Goro
* @notice Flash governance decisions are accompanied by staked collateral that can be slashed by LimboDAO. This proposal is responsible for slashing
*/
contract BurnFlashStakeDeposit is Proposal {
    struct Parameters {
        address user;
        address asset;
        uint256 amount;
        address flashGoverner;
        address targetContract;
    }

    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    function parameterize(
        address user,
        address asset,
        uint256 amount,
        address flashGoverner,
        address targetContract
    ) public notCurrent {
        params.user = user;
        params.asset = asset;
        params.amount = amount;
        params.flashGoverner = flashGoverner;
        params.targetContract = targetContract;
    }

    function execute() internal override returns (bool) {
        FlashGovernanceArbiterLike(params.flashGoverner)
            .burnFlashGovernanceAsset(
            params.targetContract,
            params.user,
            params.asset,
            params.amount
        );
        return true;
    }
}
