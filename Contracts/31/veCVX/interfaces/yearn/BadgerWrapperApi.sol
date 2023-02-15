// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "deps/@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface BadgerWrapperAPI is IERC20 {
    function name() external view returns (string calldata);

    function symbol() external view returns (string calldata);

    function decimals() external view returns (uint256);

    function token() external view returns (address);

    function pricePerShare() external view returns (uint256);

    function totalWrapperBalance(address account)
        external
        view
        returns (uint256);

    function totalVaultBalance(address account) external view returns (uint256);
}
