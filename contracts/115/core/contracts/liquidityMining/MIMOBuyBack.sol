// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAddressProvider.sol";
import "../libraries/interfaces/IVault.sol";

contract MIMOBuyback {
  bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

  IAddressProvider public a;
  IERC20 public PAR;
  IERC20 public MIMO;
  uint256 public lockExpiry;
  bytes32 public poolID;
  IVault public balancer;

  bool public whitelistEnabled = false;

  constructor(
    uint256 _lockExpiry,
    bytes32 _poolID,
    address _a,
    address _mimo,
    address _balancer
  ) public {
    lockExpiry = _lockExpiry;
    poolID = _poolID;
    a = IAddressProvider(_a);
    MIMO = IERC20(_mimo);
    PAR = a.stablex();
    balancer = IVault(_balancer);

    PAR.approve(address(balancer), 2**256 - 1);
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  modifier onlyKeeper() {
    require(!whitelistEnabled || a.controller().hasRole(KEEPER_ROLE, msg.sender), "Caller is not a Keeper");
    _;
  }

  function withdrawMIMO(address destination) public onlyManager {
    require(block.timestamp > lockExpiry, "lock not expired yet");
    require(MIMO.transfer(destination, MIMO.balanceOf(address(this))));
  }

  function buyMIMO() public onlyKeeper {
    a.core().state().refresh();
    a.feeDistributor().release();

    bytes memory userData = abi.encode();
    IVault.SingleSwap memory singleSwap = IVault.SingleSwap(
      poolID,
      IVault.SwapKind.GIVEN_IN,
      IAsset(address(PAR)), // swap in
      IAsset(address(MIMO)), // swap out
      PAR.balanceOf(address(this)), // all PAR of this contract
      userData
    );

    IVault.FundManagement memory fundManagement = IVault.FundManagement(
      address(this), // sender
      false, // useInternalBalance
      payable(address(this)), // recipient
      false // // useInternalBalance
    );

    balancer.swap(
      singleSwap,
      fundManagement,
      0, // limit, could be frontrun?
      2**256 - 1 // deadline
    );
  }

  function setWhitelistEnabled(bool _status) public onlyManager {
    whitelistEnabled = _status;
  }
}
