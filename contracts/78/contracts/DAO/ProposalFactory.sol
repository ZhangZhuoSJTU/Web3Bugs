// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../facades/LimboDAOLike.sol";
import "./Governable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

///@title Proposal
///@author Justin Goro
///@notice suggested base contract for proposals on Limbo. Not strictly enforced but strongly recommended
abstract contract Proposal {
  string public description;
  LimboDAOLike DAO;

  constructor(address dao, string memory _description) {
    DAO = LimboDAOLike(dao);
    description = _description;
  }

  modifier onlyDAO() {
    address dao = address(DAO);
    require(dao != address(0), "PROPOSAL: DAO not set");
    require(msg.sender == dao, "PROPOSAL: only DAO can invoke");
    _;
  }

  //Use this modifier on a parameterize funtion. This allows the proposal to lock itself into a readonly state during voting.
  modifier notCurrent() {
    (, , , , address proposal) = DAO.currentProposalState();
    require(proposal != address(this), "LimboDAO: proposal locked");
    _;
  }

  function orchestrateExecute() public onlyDAO {
    require(execute(), "LimboDAO: execution of proposal failed");
  }

  //override this function with all proposal logic. Only instructions included in this function will be executed if the proposal is a success.
  function execute() internal virtual returns (bool);
}

///@title Proposal Factory
///@author Justin Goro
///@notice authenticates and gatekeeps proposals up for vote on LimboDAO.
///@dev constructors are prefered to initializers when an imporant base contract exists.
contract ProposalFactory is Governable, Ownable {
  mapping(address => bool) public whitelistedProposalContracts;
  address public soulUpdateProposal;

  constructor(
    address _dao,
    address whitelistingProposal,
    address _soulUpdateProposal
  ) Governable(_dao) {
    //in order for proposals to be white listed, an initial whitelisting proposal needs to be whitelisted at deployment
    whitelistedProposalContracts[whitelistingProposal] = true;
    whitelistedProposalContracts[_soulUpdateProposal] = true;
    soulUpdateProposal = _soulUpdateProposal;
  }

  ///@notice SoulUpdateProposal is one of the most important proposals and governs the creation of new staking souls.
  ///@dev onlyOwner denotes that this important function is overseen by MorgothDAO.
  ///@param newProposal new update soul
  function changeSoulUpdateProposal(address newProposal) public onlyOwner {
    soulUpdateProposal = newProposal;
  }

  ///@notice there is no formal onchain enforcement of proposal structure and compliance. Proposal contracts must first be white listed for usage
  function toggleWhitelistProposal(address proposal) public onlySuccessfulProposal {
    whitelistedProposalContracts[proposal] = !whitelistedProposalContracts[proposal];
  }

  ///@notice user facing function to vote on a new proposal. Note that the proposal contract must first be whitelisted for usage
  ///@param proposal whitelisted popular contract
  function lodgeProposal(address proposal) public {
    require(whitelistedProposalContracts[proposal], "LimboDAO: invalid proposal");
    LimboDAOLike(DAO).makeProposal(proposal, msg.sender);
  }
}
