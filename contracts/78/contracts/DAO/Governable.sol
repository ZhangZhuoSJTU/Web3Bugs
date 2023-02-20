// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../facades/LimboDAOLike.sol";
import "../facades/FlashGovernanceArbiterLike.sol";
import "../facades/ProposalFactoryLike.sol";

///@title Governable
///@author Justin Goro
/**@dev Contracts that implement this can be governed by LimboDAO.
 * Depending on the importance and context, you can enforce governance oversight with one of two modifiers:
 *       -enforceGovernance will execute if either a proposal passes with a yes vote or if the caller is using flash governance
 *       -onlySuccessfulProposals will only execute if a proposal passes with a yes vote.
 */
abstract contract Governable {
  FlashGovernanceArbiterLike internal flashGoverner;

  bool public configured;
  address public DAO;

  /**@notice during initial setup, requiring strict multiday proposals for calibration would unecessarily delay release. 
    As long as configured is false, the contract has no governance enforcement. Calling endConfiguration is a one way operation 
    to ensure governance mechanisms kicks in. As a user, do not interact with these contracts if configured is false.
    */
  function endConfiguration() public {
    configured = true;
  }

  modifier onlySuccessfulProposal() {
    //modifiers are inline macros so you'd get a lot of code duplication if you don't refactor (EIP-170)
    assertSuccessfulProposal(msg.sender);
    _;
  }

  modifier onlySoulUpdateProposal() {
    assertSoulUpdateProposal(msg.sender);
    _;
  }

  function assertSoulUpdateProposal(address sender) internal view {
    (, , address proposalFactory) = LimboDAOLike(DAO).proposalConfig();
    require(!configured || sender == ProposalFactoryLike(proposalFactory).soulUpdateProposal(), "EJ");
    assertSuccessfulProposal(sender);
  }

  function _governanceApproved(bool emergency) internal {
    bool successfulProposal = LimboDAOLike(DAO).successfulProposal(msg.sender);
    if (successfulProposal) {
      flashGoverner.setEnforcement(false);
    } else if (configured) flashGoverner.assertGovernanceApproved(msg.sender, address(this), emergency);
  }

  modifier governanceApproved(bool emergency) {
    _governanceApproved(emergency);
    _;
    flashGoverner.setEnforcement(true);
  }

  function assertSuccessfulProposal(address sender) internal view {
    require(!configured || LimboDAOLike(DAO).successfulProposal(sender), "EJ");
  }

  constructor(address dao) {
    setDAO(dao);
  }

  ///@param dao The LimboDAO contract address
  function setDAO(address dao) public {
    require(DAO == address(0) || msg.sender == DAO || !configured, "EK");
    DAO = dao;
    flashGoverner = FlashGovernanceArbiterLike(LimboDAOLike(dao).getFlashGoverner());
  }
}
