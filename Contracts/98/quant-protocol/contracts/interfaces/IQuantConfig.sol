// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./ITimelockedConfig.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

// solhint-disable-next-line no-empty-blocks
interface IQuantConfig is ITimelockedConfig, IAccessControl {

}
