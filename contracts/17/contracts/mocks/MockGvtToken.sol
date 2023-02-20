// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "./MockGToken.sol";
import "../common/Constants.sol";

contract MockGvtToken is MockGToken, Constants {
    constructor() public ERC20("gvt", "gvt") {
        _setupDecimals(DEFAULT_DECIMALS);
    }
}
