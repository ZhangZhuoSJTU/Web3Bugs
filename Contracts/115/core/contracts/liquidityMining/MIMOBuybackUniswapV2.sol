// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAddressProvider.sol";
import "../libraries/interfaces/IUniswapV2Router02.sol";

contract MIMOBuybackUniswapV2 {
  bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

  IAddressProvider public a;
  IERC20 public PAR;
  IERC20 public MIMO;
  uint256 public lockExpiry;

  IUniswapV2Router02 public router;

  bool public whitelistEnabled = false;

  constructor(
    uint256 _lockExpiry,
    address _router,
    address _a,
    address _mimo
  ) public {
    lockExpiry = _lockExpiry;
    a = IAddressProvider(_a);
    MIMO = IERC20(_mimo);
    PAR = a.stablex();

    router = IUniswapV2Router02(_router);

    PAR.approve(address(router), 2**256 - 1);
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

    address[] memory path = new address[](2);
    path[0] = address(PAR); // tokenIn
    path[1] = address(MIMO); // tokenOut

    router.swapExactTokensForTokens(
      PAR.balanceOf(address(this)), // amountIn
      0, // amountOutMin: we can skip computing this number because the math is tested
      path,
      address(this), // receive address
      2**256 - 1 // deadline
    );
  }

  function setWhitelistEnabled(bool _status) public onlyManager {
    whitelistEnabled = _status;
  }
}
