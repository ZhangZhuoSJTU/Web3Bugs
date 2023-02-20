// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "./MockGToken.sol";
import "../common/Constants.sol";

contract MockPWRDToken is MockGToken, Constants {
    constructor() public ERC20("pwrd", "pwrd") {
        _setupDecimals(DEFAULT_DECIMALS);
    }
}
