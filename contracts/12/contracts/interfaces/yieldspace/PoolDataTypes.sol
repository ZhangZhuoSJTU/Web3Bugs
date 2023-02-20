// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;


library PoolDataTypes {
  enum TokenType { BASE, FYTOKEN, LP }

  enum Operation {
    ROUTE, // 0
    TRANSFER_TO_POOL, // 1
    FORWARD_PERMIT, // 2
    FORWARD_DAI_PERMIT, // 3
    JOIN_ETHER, // 4
    EXIT_ETHER // 5
  }
}