// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@mochifi/library/contracts/Float.sol";

interface ICSSRAdapter {
    function update(address _asset, bytes memory _data)
        external
        returns (float memory price);

    function support(address _asset) external view returns (bool);

    function getPrice(address _asset)
        external
        view
        returns (float memory price);

    function getLiquidity(address _asset)
        external
        view
        returns (uint256 _liquidity);
}
