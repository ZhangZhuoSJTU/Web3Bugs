pragma solidity >=0.6.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IBurnMintableERC20.sol";
import "./Permissions.sol";


/// @title Malt DAO
/// @author 0xScotch <scotch@malt.money>
/// @notice In essence a contract that is the oracle for the current epoch
contract MaltDAO is Initializable, Permissions {
  using SafeMath for uint256;

  IBurnMintableERC20 public malt;
  uint256 public epoch = 0;
  uint256 public epochLength;
  uint256 public genesisTime;
  uint256 public advanceIncentive = 100; // 100 Malt

  event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);
  event Mint(address recipient, uint256 amount);
  event SetMaltToken(address maltToken);
  event SetEpochLength(uint256 length);
  event SetAdvanceIncentive(uint256 incentive);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _malt,
    uint256 _epochLength,
    uint256 _genesisTime,
    address offering,
    uint256 offeringMint
  ) external initializer {
    _setMaltToken(_malt);
    _setEpochLength(_epochLength);

    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    genesisTime = _genesisTime;

    if (offeringMint > 0) {
      // Tokens minted to Community Whitelist contract
      malt.mint(offering, offeringMint);
    }
  }

  receive() external payable {}

  function advance() external {
    require(block.timestamp >= getEpochStartTime(epoch + 1), "Cannot advance epoch until start of new epoch");

    incrementEpoch();

    malt.mint(msg.sender, advanceIncentive * 1e18);

    emit Advance(epoch, block.number, block.timestamp);
  }

  function getEpochStartTime(uint256 _epoch) public view returns (uint256) {
    return genesisTime.add(epochLength.mul(_epoch));
  }

  function epochsPerYear() public view returns (uint256) {
    // 31557600 = seconds in a year
    return 31557600 / epochLength;
  }

  function mint(address to, uint256 amount)
    public
    onlyRole(TIMELOCK_ROLE, "Must have timelock role")
  {
    require(amount > 0, "Cannot have zero amount");
    malt.mint(to, amount);
    emit Mint(to, amount);
  }

  function setMaltToken(address _malt)
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    _setMaltToken(_malt);
  }

  function setEpochLength(uint256 _length)
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_length > 0, "Cannot have zero length epochs");
    _setEpochLength(_length);
  }

  function setAdvanceIncentive(uint256 incentive)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    advanceIncentive = incentive;
    emit SetAdvanceIncentive(incentive);
  }

  /* Internal methods */
  function incrementEpoch() internal {
    epoch = epoch.add(1);
  }
  
  function _setEpochLength(uint256 length) internal {
    epochLength = length;
    emit SetEpochLength(length);
  }

  function _setMaltToken(address _malt) internal {
    malt = IBurnMintableERC20(_malt);
    emit SetMaltToken(_malt);
  }
}
