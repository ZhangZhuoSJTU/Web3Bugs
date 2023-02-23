// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRootChainManager} from "../../interfaces/IRootChainManager.sol";

contract MockRootChainManager is IRootChainManager {
  address public constant ETHER_ADDRESS =
    0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  event DepositFor(
    address indexed userAddress,
    address indexed rootToken,
    bytes data
  );

  function depositFor(
    address userAddress,
    address rootToken,
    bytes memory data
  ) external override {
    require(
      rootToken != ETHER_ADDRESS,
      "RootChainManager: INVALID_ROOT_TOKEN"
    );
    require(userAddress != address(0), "RootChainManager: INVALID_USER");

    uint256 amount = abi.decode(data, (uint256));
    require(amount > 0, "RootChainManager: INVALID_AMOUNT");
    IERC20(rootToken).transferFrom(msg.sender, address(this), amount);

    emit DepositFor(userAddress, rootToken, data);
  }
}
