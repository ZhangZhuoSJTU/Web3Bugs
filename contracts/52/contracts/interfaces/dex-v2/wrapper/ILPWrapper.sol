// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "../../shared/IERC20Extended.sol";

interface ILPWrapper {
    function tokens(IERC20 foreignAsset) external view returns (IERC20Extended);

    function createWrapper(IERC20 foreignAsset) external;
}
