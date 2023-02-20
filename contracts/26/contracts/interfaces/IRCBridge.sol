// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

interface IRCBridge {
    function withdrawToMainnet(address _user, uint256 _amount) external;
}
