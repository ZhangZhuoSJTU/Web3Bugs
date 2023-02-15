// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ERC677/ERC677.sol";
import "../Flan.sol";
import "./ProposalFactory.sol";
import "../facades/SwapFactoryLike.sol";
import "../facades/UniPairLike.sol";
import "./Governable.sol";

// import "hardhat/console.sol";

library TransferHelper {
  function ERC20NetTransfer(
    address token,
    address from,
    address to,
    int256 amount
  ) public {
    if (amount > 0) {
      require(IERC20(token).transferFrom(from, to, uint256(amount)), "LimboDAO: ERC20 transfer from failed.");
    } else {
      require(IERC20(token).transfer(from, uint256(amount * (-1))), "LimboDAO: ERC20 transfer failed.");
    }
  }
}

enum FateGrowthStrategy {
  straight,
  directRoot,
  indirectTwoRootEye
}

enum ProposalDecision {
  voting,
  approved,
  rejected
}

///@title Limbo DAO
///@author Justin Goro
/**@notice
 *This is the first MicroDAO associated with MorgothDAO. A MicroDAO manages parameterization of running dapps without having
 *control over existential functionality. This is not to say that some of the decisions taken are not critical but that the domain
 *of influence is confined to the local Dapp - Limbo in this case.
 * LimboDAO has two forms of decision making: proposals and flash governance. For proposals, voting power is required. Voting power in LimboDAO is measured
 * by a points system called Fate. Staking EYE or an EYE based LP earns Fate at a quadratic rate. Fate can be used to list a proposal for voting or to vote.
 * Using Fate to make a governance decisions spens it out of existince. So Fate reflects the opportunity cost of staking.
 * Flash governance is for instant decision making that cannot wait for voting to occur. Best used for small tweaks to parameters or emergencies.
 * Flash governance requires a governance asset (EYE) be staked at the time of the execution. The asset cannot be withdrawn for a certain period of time,
 * allowing for Fate holders to vote on the legitimacy of the decision. If the decision is considered malicious, the staked EYE is burnt.
 */
///@dev Contracts subject to LimboDAO must inherit the Governable abstract contract.
contract LimboDAO is Ownable {
  event daoKilled(address newOwner);
  event proposalLodged(address proposal, address proposer);
  event voteCast(address voter, address proposal, int256 fateCast);
  event assetApproval(address asset, bool appoved);
  event proposalExecuted(address proposal, bool approved);
  event assetBurnt(address burner, address asset, uint256 fateCreated);

  using TransferHelper for address;
  uint256 constant ONE = 1 ether;
  uint256 precision = 1e9;

  struct DomainConfig {
    address limbo;
    address flan;
    address eye;
    address fate;
    bool live;
    address flashGoverner;
    address sushiFactory;
    address uniFactory;
  }

  struct ProposalConfig {
    uint256 votingDuration;
    uint256 requiredFateStake;
    address proposalFactory; //check this for creating proposals
  }

  struct ProposalState {
    int256 fate;
    ProposalDecision decision;
    address proposer;
    uint256 start;
    Proposal proposal;
  }

  //rateCrate
  struct FateState {
    uint256 fatePerDay;
    uint256 fateBalance;
    uint256 lastDamnAdjustment;
  }

  struct AssetClout {
    uint256 fateWeight;
    uint256 balance;
  }

  DomainConfig public domainConfig;
  ProposalConfig public proposalConfig;

  /**@notice for staking EYE, we simply take the square root of staked amount.
   * For LP tokens, only half the value of the token is EYE so it's tempting to take the square root for the EYE balance. However this punishes the holder by ignoring the cost incurred by supplying the other asset. Since the other asset at rest is equal in value to the EYE balance, we just multiply the calculation by 2.
   */
  mapping(address => FateGrowthStrategy) public fateGrowthStrategy;
  mapping(address => bool) public assetApproved;
  mapping(address => FateState) public fateState; //lateDate

  //Fate is earned per day. Keeping track of relative staked values, we can increment user balance
  mapping(address => mapping(address => AssetClout)) public stakedUserAssetWeight; //user->asset->weight

  ProposalState public currentProposalState;
  ProposalState public previousProposalState;

  // Since staking EYE precludes it from earning Flan on Limbo, fateToFlan can optionally be set to a non zero number to allow fat holders to spend their fate for Flan.
  uint256 public fateToFlan;

  modifier isLive() {
    require(domainConfig.live, "LimboDAO: DAO is not live.");
    _;
  }

  function nextProposal() internal {
    previousProposalState = currentProposalState;
    currentProposalState.proposal = Proposal(address(0));
    currentProposalState.fate = 0;
    currentProposalState.decision = ProposalDecision.voting;
    currentProposalState.proposer = address(0);
    currentProposalState.start = 0;
  }

  modifier onlySuccessfulProposal() {
    // console.log('onlySuccessfulProposal');
    require(successfulProposal(msg.sender), "LimboDAO: approve proposal");
    _;
    //nextProposal();
  }

  ///@notice has a proposal successfully been approved?
  function successfulProposal(address proposal) public view returns (bool) {
    return
      currentProposalState.decision == ProposalDecision.approved && proposal == address(currentProposalState.proposal);
  }

  modifier updateCurrentProposal() {
    incrementFateFor(_msgSender());
    if (address(currentProposalState.proposal) != address(0)) {
      uint256 durationSinceStart = block.timestamp - currentProposalState.start;
      if (
        durationSinceStart >= proposalConfig.votingDuration && currentProposalState.decision == ProposalDecision.voting
      ) {
        if (currentProposalState.fate > 0) {
          currentProposalState.decision = ProposalDecision.approved;
          currentProposalState.proposal.orchestrateExecute();
          fateState[currentProposalState.proposer].fateBalance += proposalConfig.requiredFateStake;
        } else {
          currentProposalState.decision = ProposalDecision.rejected;
        }
        emit proposalExecuted(
          address(currentProposalState.proposal),
          currentProposalState.decision == ProposalDecision.approved
        );
        nextProposal();
      }
    }
    _;
  }

  modifier incrementFate() {
    incrementFateFor(_msgSender());
    _;
  }

  function incrementFateFor(address user) public {
    FateState storage state = fateState[user];
    state.fateBalance += (state.fatePerDay * (block.timestamp - state.lastDamnAdjustment)) / (1 days);
    state.lastDamnAdjustment = block.timestamp;
  }

  ///@param limbo address of Limbo
  ///@param flan address of Flan
  ///@param eye address of EYE token
  ///@param proposalFactory authenticates and instantiates valid proposals for voting
  ///@param sushiFactory is the SushiSwap Factory contract
  ///@param uniFactory is the UniSwapV2 Factory contract
  ///@param flashGoverner oversees flash governance cryptoeconomics
  ///@param precisionOrderOfMagnitude when comparing fractional values, it's not necessary to get every last digit right
  ///@param sushiLPs valid EYE containing LP tokens elligible for earning Fate through staking
  ///@param uniLPs valid EYE containing LP tokens elligible for earning Fate through staking
  function seed(
    address limbo,
    address flan,
    address eye,
    address proposalFactory,
    address sushiFactory,
    address uniFactory,
    address flashGoverner,
    uint256 precisionOrderOfMagnitude,
    address[] memory sushiLPs,
    address[] memory uniLPs
  ) public onlyOwner {
    _seed(limbo, flan, eye, sushiFactory, uniFactory, flashGoverner);
    proposalConfig.votingDuration = 2 days;
    proposalConfig.requiredFateStake = 223 * ONE; //50000 EYE for 24 hours
    proposalConfig.proposalFactory = proposalFactory;
    precision = 10**precisionOrderOfMagnitude;
    for (uint256 i = 0; i < sushiLPs.length; i++) {
      require(UniPairLike(sushiLPs[i]).factory() == sushiFactory, "LimboDAO: invalid Sushi LP");
      if (IERC20(eye).balanceOf(sushiLPs[i]) > 1000) assetApproved[sushiLPs[i]] = true;
      fateGrowthStrategy[sushiLPs[i]] = FateGrowthStrategy.indirectTwoRootEye;
    }
    for (uint256 i = 0; i < uniLPs.length; i++) {
      require(UniPairLike(uniLPs[i]).factory() == uniFactory, "LimboDAO: invalid Sushi LP");
      if (IERC20(eye).balanceOf(uniLPs[i]) > 1000) assetApproved[uniLPs[i]] = true;
      fateGrowthStrategy[uniLPs[i]] = FateGrowthStrategy.indirectTwoRootEye;
    }
  }

  ///@notice allows Limbo to be governed by a new DAO
  ///@dev functions marked by onlyOwner are governed by MorgothDAO
  function killDAO(address newOwner) public onlyOwner isLive {
    domainConfig.live = false;
    Governable(domainConfig.flan).setDAO(newOwner);
    Governable(domainConfig.limbo).setDAO(newOwner);
    emit daoKilled(newOwner);
  }

  ///@notice optional conversion rate of Fate to Flan
  function setFateToFlan(uint256 rate) public onlySuccessfulProposal {
    fateToFlan = rate;
  }

  ///@notice caller spends their Fate to earn Flan
  function convertFateToFlan(uint256 fate) public returns (uint256 flan) {
    require(fateToFlan > 0, "LimboDAO: Fate conversion to Flan disabled.");
    fateState[msg.sender].fateBalance -= fate;
    flan = (fateToFlan * fate) / ONE;
    Flan(domainConfig.flan).mint(msg.sender, flan);
  }

  /**@notice handles proposal lodging logic. A deposit of Fate is removed from the user. If the decision is a success, half the fate is returned.
   *  This is to encourage only lodging of proposals that are likely to succeed.
   *  @dev not for external calling. Use the proposalFactory to lodge a proposal instead.
   */
  function makeProposal(address proposal, address proposer) public updateCurrentProposal {
    address sender = _msgSender();
    require(sender == proposalConfig.proposalFactory, "LimboDAO: only Proposal Factory");
    require(address(currentProposalState.proposal) == address(0), "LimboDAO: active proposal.");

    fateState[proposer].fateBalance = fateState[proposer].fateBalance - proposalConfig.requiredFateStake * 2;
    currentProposalState.proposal = Proposal(proposal);
    currentProposalState.decision = ProposalDecision.voting;
    currentProposalState.fate = 0;
    currentProposalState.proposer = proposer;
    currentProposalState.start = block.timestamp;
    emit proposalLodged(proposal, proposer);
  }

  ///@notice handles proposal voting logic.
  ///@param proposal contract to be voted on
  ///@param fate positive is YES, negative is NO. Absolute value is deducted from caller.
  function vote(address proposal, int256 fate) public incrementFate isLive {
    require(
      proposal == address(currentProposalState.proposal), //this is just to protect users with out of sync UIs
      "LimboDAO: stated proposal does not match current proposal"
    );
    require(currentProposalState.decision == ProposalDecision.voting, "LimboDAO: voting on proposal closed");
    if (block.timestamp - currentProposalState.start > proposalConfig.votingDuration - 1 hours) {
      int256 currentFate = currentProposalState.fate;
      //check if voting has ended
      if (block.timestamp - currentProposalState.start > proposalConfig.votingDuration) {
        revert("LimboDAO: voting for current proposal has ended.");
      } else if (
        //The following if statement checks if the vote is flipped by fate
        fate * currentFate < 0 && //sign different
        (fate + currentFate) * fate > 0 //fate flipped current fate onto the same side of zero as fate
      ) {
        //extend voting duration when vote flips decision. Suggestion made by community member
        currentProposalState.start = currentProposalState.start + 2 hours;
      }
    }
    uint256 cost = fate > 0 ? uint256(fate) : uint256(-fate);
    fateState[_msgSender()].fateBalance = fateState[_msgSender()].fateBalance - cost;

    currentProposalState.fate += fate;
    emit voteCast(_msgSender(), proposal, fate);
  }

  ///@notice pushes the decision to execute a successful proposal. For convenience only
  function executeCurrentProposal() public updateCurrentProposal {}

  ///@notice parameterizes the voting
  ///@param requiredFateStake the amount of Fate required to lodge a proposal
  ///@param votingDuration the duration of voting in seconds
  ///@param proposalFactory the address of the proposal factory
  function setProposalConfig(
    uint256 votingDuration,
    uint256 requiredFateStake,
    address proposalFactory
  ) public onlySuccessfulProposal {
    proposalConfig.votingDuration = votingDuration;
    proposalConfig.requiredFateStake = requiredFateStake;
    proposalConfig.proposalFactory = proposalFactory;
  }

  ///@notice Assets approved for earning Fate
  function setApprovedAsset(address asset, bool approved) public onlySuccessfulProposal {
    assetApproved[asset] = approved;
    fateGrowthStrategy[asset] = FateGrowthStrategy.indirectTwoRootEye;
    emit assetApproval(asset, approved);
  }

  ///@notice handles staking logic for EYE and EYE based assets so that correct rate of fate is earned.
  ///@param finalAssetBalance after staking, what is the final user balance on LimboDAO of the asset in question
  ///@param finalEYEBalance if EYE is being staked, this value is the same as finalAssetBalance but for LPs it's about half
  ///@param rootEYE offload high gas arithmetic to the client. Cheap to verify. Square root in fixed point requires Babylonian algorithm
  ///@param asset the asset being staked
  function setEYEBasedAssetStake(
    uint256 finalAssetBalance,
    uint256 finalEYEBalance,
    uint256 rootEYE,
    address asset
  ) public isLive incrementFate {
    require(assetApproved[asset], "LimboDAO: illegal asset");
    address sender = _msgSender();
    FateGrowthStrategy strategy = fateGrowthStrategy[asset];

    //verifying that rootEYE value is accurate within precision.
    uint256 rootEYESquared = rootEYE * rootEYE;
    uint256 rootEYEPlusOneSquared = (rootEYE + 1) * (rootEYE + 1);
    require(
      rootEYESquared <= finalEYEBalance && rootEYEPlusOneSquared > finalEYEBalance,
      "LimboDAO: Stake EYE invariant."
    );
    AssetClout storage clout = stakedUserAssetWeight[sender][asset];
    fateState[sender].fatePerDay -= clout.fateWeight;
    uint256 initialBalance = clout.balance;
    //EYE
    if (strategy == FateGrowthStrategy.directRoot) {
      require(finalAssetBalance == finalEYEBalance, "LimboDAO: staking eye invariant.");
      require(asset == domainConfig.eye);

      clout.fateWeight = rootEYE;
      clout.balance = finalAssetBalance;
      fateState[sender].fatePerDay += rootEYE;
    } else if (strategy == FateGrowthStrategy.indirectTwoRootEye) {
      //LP
      clout.fateWeight = 2 * rootEYE;
      fateState[sender].fatePerDay += clout.fateWeight;

      uint256 actualEyeBalance = IERC20(domainConfig.eye).balanceOf(asset);
      require(actualEyeBalance > 0, "LimboDAO: No EYE");
      uint256 totalSupply = IERC20(asset).totalSupply();
      uint256 eyePerUnit = (actualEyeBalance * ONE) / totalSupply;
      uint256 impliedEye = (eyePerUnit * finalAssetBalance) / (ONE * precision);
      finalEYEBalance /= precision;
      require(
        finalEYEBalance == impliedEye, //precision cap
        "LimboDAO: stake invariant check 2."
      );
      clout.balance = finalAssetBalance;
    } else {
      revert("LimboDAO: asset growth strategy not accounted for");
    }
    int256 netBalance = int256(finalAssetBalance) - int256(initialBalance);
    asset.ERC20NetTransfer(sender, address(this), netBalance);
  }

  /**
   *@notice Acquiring enough fate to either influence a decision or to lodge a proposal can take very long.
   * If a very important decision has to be acted on via a proposal, the option exists to buy large quantities for fate instantly by burning an EYE based asset
   * This may be necessary if a vote is nearly complete by the looming outcome is considered unacceptable.
   * While Fate accumulation is quadratic for staking, burning is linear and subject to a factor of 10. This gives whales effective veto power but at the cost of a permanent
   * loss of EYE.
   *@param asset the asset to burn and can be EYE or EYE based assets
   *@param amount the amount of asset to burn
   */
  function burnAsset(address asset, uint256 amount) public isLive incrementFate {
    require(assetApproved[asset], "LimboDAO: illegal asset");
    address sender = _msgSender();
    require(ERC677(asset).transferFrom(sender, address(this), amount), "LimboDAO: transferFailed");
    uint256 fateCreated = fateState[_msgSender()].fateBalance;
    if (asset == domainConfig.eye) {
      fateCreated = amount * 10;
      ERC677(domainConfig.eye).burn(amount);
    } else {
      uint256 actualEyeBalance = IERC20(domainConfig.eye).balanceOf(asset);
      require(actualEyeBalance > 0, "LimboDAO: No EYE");
      uint256 totalSupply = IERC20(asset).totalSupply();
      uint256 eyePerUnit = (actualEyeBalance * ONE) / totalSupply;
      uint256 impliedEye = (eyePerUnit * amount) / ONE;
      fateCreated = impliedEye * 20;
    }
    fateState[_msgSender()].fateBalance += fateCreated;
    emit assetBurnt(_msgSender(), asset, fateCreated);
  }

  ///@notice grants unlimited Flan minting power to an address.
  function approveFlanMintingPower(address minter, bool enabled) public onlySuccessfulProposal isLive {
    Flan(domainConfig.flan).increaseMintAllowance(minter, enabled ? type(uint256).max : 0);
  }

  ///@notice call this after initial config is complete.
  function makeLive() public onlyOwner {
    require(
      Governable(domainConfig.limbo).DAO() == address(this) && Governable(domainConfig.flan).DAO() == address(this),
      "LimboDAO: transfer ownership of limbo and flan."
    );
    domainConfig.live = true;
  }

  ///@notice if the DAO is being dismantled, it's necessary to transfer any owned items
  function transferOwnershipOfThing(address thing, address destination) public onlySuccessfulProposal {
    Ownable(thing).transferOwnership(destination);
  }

  function timeRemainingOnProposal() public view returns (uint256) {
    require(currentProposalState.decision == ProposalDecision.voting, "LimboDAO: proposal finished.");
    uint256 elapsed = block.timestamp - currentProposalState.start;
    if (elapsed > proposalConfig.votingDuration) return 0;
    return proposalConfig.votingDuration - elapsed;
  }

  /**@notice seed is a goro idiom for initialize that you tend to find in all the dapps I've written.
   * I prefer initialization funcitons to parameterized solidity constructors for reasons beyond the scope of this comment.
   */
  function _seed(
    address limbo,
    address flan,
    address eye,
    address sushiFactory,
    address uniFactory,
    address flashGoverner
  ) internal {
    domainConfig.limbo = limbo;
    domainConfig.flan = flan;
    domainConfig.eye = eye;
    domainConfig.uniFactory = uniFactory;
    domainConfig.sushiFactory = sushiFactory;
    domainConfig.flashGoverner = flashGoverner;
    assetApproved[eye] = true;
    fateGrowthStrategy[eye] = FateGrowthStrategy.directRoot;
  }

  function getFlashGoverner() external view returns (address) {
    return domainConfig.flashGoverner;
  }
}
