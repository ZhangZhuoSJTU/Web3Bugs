// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IPausable {
    function pause() external returns (bool);

    function unpause() external returns (bool);

    function isPaused() external view returns (bool);

    function isAuthorizedToPause(address account) external view returns (bool);
}
