// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./ComptrollerInterface.sol";
import "./ComptrollerStorage.sol";

abstract contract Comptroller is ComptrollerV5Storage, ComptrollerInterface {
    function getAssetsIn(address account) external view virtual returns (CToken[] memory);

    function getAllMarkets() public view virtual returns (CToken[] memory);

    function isDeprecated(address cToken) public view virtual returns (bool);
}
