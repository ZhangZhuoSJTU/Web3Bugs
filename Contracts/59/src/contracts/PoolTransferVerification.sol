pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./interfaces/IMaltDataLab.sol";
import "./Permissions.sol";
import "./AbstractTransferVerification.sol";


/// @title Pool Transfer Verification
/// @author 0xScotch <scotch@malt.money>
/// @notice Implements ability to block Malt transfers
contract PoolTransferVerification is AbstractTransferVerification, Initializable {
  uint256 public thresholdBps;
  IMaltDataLab public maltDataLab;
  uint256 public priceLookback;
  address public pool;

  mapping(address => bool) public whitelist;

  event AddToWhitelist(address indexed _address);
  event RemoveFromWhitelist(address indexed _address);
  event SetPool(address indexed pool);
  event SetPriceLookback(uint256 lookback);
  event SetThreshold(uint256 newThreshold);

  function initialize(
    address _timelock,
    address initialAdmin,
    uint256 _thresholdBps,
    address _maltDataLab,
    uint256 _lookback,
    address _pool
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    thresholdBps = _thresholdBps;
    maltDataLab = IMaltDataLab(_maltDataLab);
    priceLookback = _lookback;
    pool = _pool;
  }

  function verifyTransfer(address from, address to, uint256 amount) 
    public view override returns (bool, string memory) 
  {
    // This contract only cares about transfers out of the pool
    if (from != pool) {
      return (true, "");
    }

    if (isWhitelisted(to)) {
      return (true, "");
    }

    uint256 priceTarget = maltDataLab.priceTarget();

    return (
      maltDataLab.maltPriceAverage(priceLookback) > priceTarget * (10000 - thresholdBps) / 10000,
      "The price of Malt is below peg. Wait for peg to be regained or purchase arbitrage tokens."
    );
  }

  function isWhitelisted(address _address) public view returns(bool) {
    return whitelist[_address];
  }

  /*
   * PRIVILEDGED METHODS
   */
  function setThreshold(uint256 newThreshold)
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(newThreshold > 0 && newThreshold < 10000, "Threshold must be between 0-100%");
    thresholdBps = newThreshold;
    emit SetThreshold(newThreshold);
  }

  function setPriceLookback(uint256 lookback)
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(lookback > 0, "Cannot have 0 lookback");
    priceLookback = lookback;
    emit SetPriceLookback(lookback);
  }

  function setPool(address _pool)
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_pool != address(0), "Cannot have 0 lookback");
    pool = _pool;
    emit SetPool(_pool);
  }

  function addToWhitelist(address _address) 
    public
    onlyRole(ADMIN_ROLE, "Must have admin role") 
  {
    whitelist[_address] = true;
    emit AddToWhitelist(_address);
  }

  function removeFromWhitelist(address _address) 
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")  
  {
    if (!whitelist[_address]) {
      return;
    }
    whitelist[_address] = false;
    emit RemoveFromWhitelist(_address);
  }
}
