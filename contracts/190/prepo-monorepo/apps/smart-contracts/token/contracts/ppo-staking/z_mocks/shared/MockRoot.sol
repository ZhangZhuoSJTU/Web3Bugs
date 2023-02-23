// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Root} from "../../shared/Root.sol";

contract MockRoot {
  function sqrt(uint256 r) public pure returns (uint256) {
    return Root.sqrt(r);
  }
}
