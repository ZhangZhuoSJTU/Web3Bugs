// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../shared/IERC20Extended.sol";
import "./ISynth.sol";

interface ISynthFactory {
    function synths(IERC20 token) external view returns (ISynth);

    function createSynth(IERC20Extended token) external returns (ISynth);
}
