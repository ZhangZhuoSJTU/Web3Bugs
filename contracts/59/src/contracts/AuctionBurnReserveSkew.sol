pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStabilizerNode.sol";
import "./Auction.sol";
import "./Permissions.sol";


/// @title Auction Burn Reserve Skew
/// @author 0xScotch <scotch@malt.money>
/// @notice This contract makes decisions about what do to with excess Liquidity Extension balance at the end of an auction. Burn additional Malt or retain capital in LE
contract AuctionBurnReserveSkew is Initializable, Permissions {
  using SafeMath for uint256;

  // An array of 0s or 1s that track if active stabilization was 
  // needed above or below peg.
  // 0 = below peg
  // 1 = above peg
  //
  // By doing this we can average the array to get a value that
  // indicates if we are more frequently over or under peg.
  uint256[] public pegObservations;
  uint256 public auctionAverageLookback = 10;

  IStabilizerNode public stabilizerNode;
  IAuction public auction;

  // This is the total number of stabilization observation we have seen
  uint256 public count;

  event SetAuctionAverageLookback(uint256 lookback);
  event SetStabilizerNode(address stabilizerNode);
  event SetAuction(address auction);
  event AbovePegObservation(uint256 amount);
  event BelowPegObservation(uint256 amount);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _stabilizerNode,
    address _auction,
    uint256 _period
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(STABILIZER_NODE_ROLE, _stabilizerNode);
    _setupRole(ADMIN_ROLE, initialAdmin);

    stabilizerNode = IStabilizerNode(_stabilizerNode);
    auction = IAuction(_auction);
    auctionAverageLookback = _period;

    for (uint i = 0; i < _period; i++) {
      pegObservations.push(0);
    }
  }

  function consult(uint256 excess) public view returns (uint256) {
    uint256 frequency = getPegDeltaFrequency();
    uint256 participation = getAverageParticipation();

    // Weight participation higher than frequency
    uint256 skew = (frequency + (participation * 2)) / 3;

    return excess.mul(skew).div(10000);
  }

  function getRealBurnBudget(
    uint256 maxBurnSpend,
    uint256 premiumExcess
  ) public view returns(uint256) {
    // Returning maxBurnSpend = maximum supply burn with no reserve ratio improvement
    // Returning premiumExcess = maximum reserve ratio improvement with no real supply burn

    if (premiumExcess > maxBurnSpend) {
      return premiumExcess;
    }

    uint256 usableExcess = maxBurnSpend.sub(premiumExcess);

    if (usableExcess == 0) {
      return premiumExcess;
    }

    uint256 burnable = consult(usableExcess);

    return premiumExcess + burnable;
  }

  function getAverageParticipation() public view returns (uint256) {
    uint256 initialAuction = 0;
    uint256 currentAuctionId = auction.currentAuctionId();

    if (currentAuctionId > auctionAverageLookback) {
      initialAuction = currentAuctionId - auctionAverageLookback;
    }

    // Use the existing struct to avoid filling the stack with temp vars
    AuctionData memory aggregate;

    for (uint256 i = initialAuction; i < currentAuctionId; ++i) {
      (uint256 commitments, uint256 maxCommitments) = auction.getAuctionCommitments(i);
      aggregate.maxCommitments = aggregate.maxCommitments + maxCommitments;
      aggregate.commitments = aggregate.commitments + commitments;
    }

    uint256 participation = 0;
    if (aggregate.maxCommitments > 0) {
      participation = aggregate.commitments.mul(10000).div(aggregate.maxCommitments);
    }

    return participation;
  }

  function getPegDeltaFrequency() public view returns (uint256) {
    uint256 initialIndex = 0;
    uint256 index;

    if (count > auctionAverageLookback) {
      initialIndex = count - auctionAverageLookback;
    }

    uint256 total = 0;

    for (uint256 i = initialIndex; i < count; ++i) {
      index = _getIndexOfObservation(i);
      total = total + pegObservations[index];
    }

    return total * 10000 / auctionAverageLookback;
  }

  function _getIndexOfObservation(uint _index) internal view returns (uint index) {
    return _index % auctionAverageLookback;
  }

  /*
   * The arguments passed into these observation functions are not currently used but they are added
   * incase future versions to this contract want to use them. In that case the stabilizernode
   * won't have to be changed as it is already passing in this argument.
   */
  function addAbovePegObservation(uint256 amount)
    public
    onlyRole(STABILIZER_NODE_ROLE, "Must be a stabilizer node to call this method")
  {
    uint256 index = _getIndexOfObservation(count);
    // above peg
    pegObservations[index] = 1;

    count = count + 1;
    emit AbovePegObservation(amount);
  }

  function addBelowPegObservation(uint256 amount)
    public
    onlyRole(STABILIZER_NODE_ROLE, "Must be a stabilizer node to call this method")
  {
    uint256 index = _getIndexOfObservation(count);
    // below peg
    pegObservations[index] = 0;

    count = count + 1;
    emit BelowPegObservation(amount);
  }

  function setNewStabilizerNode(address _node)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_node != address(0), "Cannot set 0 address");
    _swapRole(_node, address(stabilizerNode), STABILIZER_NODE_ROLE);
    stabilizerNode = IStabilizerNode(_node);
    emit SetStabilizerNode(_node);
  }

  function setNewAuction(address _auction)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_auction != address(0), "Cannot set 0 address");
    auction = IAuction(_auction);
    emit SetAuction(_auction);
  }

  function setAuctionAverageLookback(uint256 _lookback)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_lookback > 0, "Cannot have zero lookback period");

    if (_lookback > auctionAverageLookback) {
      for (uint i = auctionAverageLookback; i < _lookback; i++) {
        pegObservations.push(0);
      }
    }

    auctionAverageLookback = _lookback;
    emit SetAuctionAverageLookback(_lookback);
  }
}
