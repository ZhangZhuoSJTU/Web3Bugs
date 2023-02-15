// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IBadgerERC1155 {
    function balanceOf(address account, uint256 id)
        external
        view
        returns (uint256);

    function totalSupply(uint256 id) external view returns (uint256);

    function tokenSupply(uint256 id) external view returns (uint256);

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;
}
