// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./IERC165Upgradeable.sol";

interface IPrevNftxContract {
    function isEligible(uint256 fundId, uint256 nftId) external view returns (bool);
}