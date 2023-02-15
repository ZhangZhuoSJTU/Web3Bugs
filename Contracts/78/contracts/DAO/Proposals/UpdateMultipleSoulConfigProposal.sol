// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/AMMHelper.sol";
import "../../facades/MorgothTokenApproverLike.sol";

/**
* @author Justin Goro
* @notice For adding a list of new souls to Limbo for staking 
*/
contract UpdateMultipleSoulConfigProposal is Proposal {
  struct Parameters {
    address token;
    uint256 crossingThreshold;
    uint256 soulType;
    uint256 state;
    uint256 index;
    uint256 targetAPY;
    uint256 daiThreshold;
  }

  Parameters[] params;
  LimboLike limbo;
  AMMHelper ammHelper;
  MorgothTokenApproverLike morgothApprover;

  constructor(
    address dao,
    string memory _description,
    address _limbo,
    address _ammHelper,
    address morgothTokenApprover
  ) Proposal(dao, _description) {
    limbo = LimboLike(_limbo);
    ammHelper = AMMHelper(_ammHelper);
    morgothApprover = MorgothTokenApproverLike(morgothTokenApprover);
  }

  function parameterize(
    address token,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 index,
    uint256 targetAPY,
    uint256 daiThreshold
  ) public notCurrent {
    require(morgothApprover.approved(token), "MORGOTH: token not approved for listing on Behodler");
    params.push(
      Parameters({
        token: token,
        crossingThreshold: crossingThreshold,
        soulType: soulType,
        state: state,
        index: index,
        targetAPY: targetAPY,
        daiThreshold: daiThreshold
      })
    );
  }

  function execute() internal override returns (bool) {
    for (uint256 i = 0; i < params.length; i++) {
      uint256 fps = ammHelper.minAPY_to_FPS(params[i].targetAPY, params[i].daiThreshold);
      limbo.configureSoul(
        params[i].token,
        params[i].crossingThreshold,
        params[i].soulType,
        params[i].state,
        params[i].index,
        fps
      );
    }

    return true;
  }
}
