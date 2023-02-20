// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/MorgothTokenApproverLike.sol";
import "hardhat/console.sol";

/**
* @author Justin Goro
* @notice The singular form of UpdateMultiplSoulConfig
*/
contract UpdateSoulConfigProposal is Proposal {
    struct Parameters {
        address token;
        uint256 crossingThreshold;
        uint256 soulType;
        uint256 state;
        uint256 index;
        uint256 fps;
    }
    Parameters params;
    LimboLike limbo;
    MorgothTokenApproverLike morgothApprover;

    constructor(
        address dao,
        string memory _description,
        address _limbo,
        address morgothTokenApprover
    ) Proposal(dao, _description) {
        limbo = LimboLike(_limbo);
        morgothApprover = MorgothTokenApproverLike(morgothTokenApprover);
    }

    function parameterize(
        address token,
        uint256 crossingThreshold,
        uint256 soulType,
        uint256 state,
        uint256 index,
        uint256 fps
    ) public notCurrent {
        require(
            morgothApprover.approved(token),
            "MORGOTH: token not approved for listing on Behodler"
        );
        params.token = token;
        params.crossingThreshold = crossingThreshold;
        params.soulType = soulType;
        params.state = state;
        params.index = index;
        params.fps = fps;
    }

    function execute() internal override returns (bool) {
        console.log("token: %s, index: %s",params.token,params.index);
        limbo.configureSoul(
            params.token,
            params.crossingThreshold,
            params.soulType,
            params.state,
            params.index,
            params.fps
        );

        return true;
    }
}
