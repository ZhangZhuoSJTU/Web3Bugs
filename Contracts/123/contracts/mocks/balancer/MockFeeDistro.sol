// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

interface IFeeDistributor {
    function claimToken(address user, IERC20 token) external returns (uint256);

    function claimTokens(address user, IERC20[] calldata tokens) external returns (uint256[] memory);

    function getTokenTimeCursor(IERC20 token) external view returns (uint256);
}

// @dev - Must be funded by transferring crv to this contract post deployment, as opposed to minting directly
contract MockFeeDistributor is IFeeDistributor {
    mapping(address => uint256) private tokenRates;

    constructor(address[] memory _tokens, uint256[] memory _rates) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokenRates[_tokens[i]] = _rates[i];
        }
    }

    function claimToken(address user, IERC20 token) external returns (uint256) {
        return _claimToken(user, token);
    }

    function _claimToken(address user, IERC20 token) internal returns (uint256) {
        uint256 rate = tokenRates[address(token)];
        if (rate > 0) {
            token.transfer(user, rate);
        }
        return rate;
    }

    function claimTokens(address user, IERC20[] calldata tokens) external returns (uint256[] memory) {
        uint256[] memory rates = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            rates[i] = _claimToken(user, tokens[i]);
        }
        return rates;
    }

    function getTokenTimeCursor(IERC20 token) external view returns (uint256) {
        return 1;
    }
}
