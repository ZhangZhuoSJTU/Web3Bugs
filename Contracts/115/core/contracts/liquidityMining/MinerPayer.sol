pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";

/*
@title Miner Payer
@notice A tool for sending MIMO tokens to a set of miners
*/
contract MinerPayer {
  event PayeeAdded(address account, uint256 shares);
  event TokensReleased(uint256 newTokens, uint256 releasedAt);
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 public totalShares;
  IGovernanceAddressProvider public a;
  bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
  mapping(address => uint256) public shares;
  address[] public payees;

  modifier onlyKeeper() {
    require(a.controller().hasRole(KEEPER_ROLE, msg.sender), "Caller is not a Keeper");
    _;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a manager");
    _;
  }

  constructor(IGovernanceAddressProvider _a) public {
    require(address(_a) != address(0), "Governance address can't be 0 address");
    a = _a;
  }

  /*
  @notice Sends a total amount of MIMO tokens held by this contract to a set of miners, distributing the total amount as per the shares array stored in the contract
  @param totalAmount The total amount to send all of the miners
  */
  function release(uint256 totalAmount) public onlyKeeper {
    require(totalAmount <= a.mimo().balanceOf(address(this)), "Contract doesn't hold enough MIMO to distribute");
    require(totalAmount > 0, "newTokens is 0");
    // Send MIMO to all receivers
    for (uint256 i = 0; i < payees.length; i++) {
      address payee = payees[i];
      _release(totalAmount, payee);
    }
    emit TokensReleased(totalAmount, now);
  }

  /**
    Updates the payee configuration to a new one.
    @param _payees Array of payees
    @param _shares Array of shares for each payee
  */
  function changePayees(address[] memory _payees, uint256[] memory _shares) public onlyManager {
    require(_payees.length == _shares.length, "Payees and shares mismatched");

    for (uint256 i = 0; i < payees.length; i++) {
      delete shares[payees[i]];
    }

    delete payees;
    totalShares = 0;

    for (uint256 i = 0; i < _payees.length; i++) {
      _addPayee(_payees[i], _shares[i]);
    }
  }

  /**
    Get current configured payees.
    @return array of current payees.
  */
  function getPayees() public view returns (address[] memory) {
    return payees;
  }

  /**
    Internal function to release a percentage of newTokens to a specific payee
    @dev uses totalShares to calculate correct share
    @dev same as _release in BaseDistributor
    @param _totalnewTokensReceived Total newTokens for all payees, will be split according to shares
    @param _payee The address of the payee to whom to distribute the fees.
  */
  function _release(uint256 _totalnewTokensReceived, address _payee) internal {
    uint256 payment = _totalnewTokensReceived.mul(shares[_payee]).div(totalShares);
    a.mimo().transfer(_payee, payment);
  }

  /**
    Internal function to add a new payee. 
    @dev will update totalShares and therefore reduce the relative share of all other payees. 
    @dev Same as _addPayee in BaseDistributor.
    @param _payee The address of the payee to add.
    @param _shares The number of shares owned by the payee.
  */
  function _addPayee(address _payee, uint256 _shares) internal {
    require(_payee != address(0), "Payee is the zero address");
    require(_shares > 0, "Shares are 0");
    require(shares[_payee] == 0, "Payee already has shares");

    payees.push(_payee);
    shares[_payee] = _shares;
    totalShares = totalShares.add(_shares);
    emit PayeeAdded(_payee, _shares);
  }
}
