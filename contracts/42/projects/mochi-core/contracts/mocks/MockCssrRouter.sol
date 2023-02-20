// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@mochifi/cssr/contracts/interfaces/ICSSRRouter.sol";
import "@mochifi/cssr/contracts/interfaces/IUniswapV2CSSR.sol";
import "@mochifi/cssr/contracts/mocks/MockEngine.sol";
import "@mochifi/cssr/contracts/MochiCSSRv0.sol";
import "@mochifi/cssr/contracts/cssr/UniswapV2CSSR.sol";
import "@mochifi/cssr/contracts/cssr/SushiswapV2CSSR.sol";
import "@mochifi/cssr/contracts/adapter/ChainlinkAdapter.sol";
import "@mochifi/cssr/contracts/adapter/UniswapV2TokenAdapter.sol";
import "@mochifi/cssr/contracts/adapter/UniswapV2LPAdapter.sol";
import "@mochifi/cssr/contracts/adapter/SushiswapV2LPAdapter.sol";

contract MockCssrRouter is ICSSRRouter {
    mapping(address => uint256) public numerator;

    function setPrice(address _asset, uint256 _newPrice) external {
        numerator[_asset] = _newPrice;
    }

    function update(address _asset, bytes memory _data)
        external
        override
        returns (float memory)
    {
        return getPrice(_asset);
    }

    function getPrice(address _asset)
        public
        view
        override
        returns (float memory)
    {
        // always 1 dollar
        if (numerator[_asset] == 0) {
            return float({numerator: 1e18, denominator: 1e18});
        } else {
            return float({numerator: numerator[_asset], denominator: 1e18});
        }
    }

    function getLiquidity(address _asset)
        external
        view
        override
        returns (uint256)
    {
        return 1_000_000_000_000e18;
    }
}
