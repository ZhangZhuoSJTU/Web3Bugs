// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@mochifi/library/contracts/Float.sol";
import "../interfaces/IGovernanceOwned.sol";
import "../interfaces/ICSSRAdapter.sol";

contract ChainlinkAdapterEth is ICSSRAdapter {
    IGovernanceOwned public immutable owned;

    mapping(address => AggregatorV3Interface) public feed;

    modifier onlyGov() {
        require(msg.sender == owned.governance(), "!gov");
        _;
    }

    constructor(address _owned) {
        owned = IGovernanceOwned(_owned);
    }

    function update(address _asset, bytes calldata _data)
        external
        override
        returns (float memory)
    {
        return getPrice(_asset);
    }

    function setFeed(address[] calldata _assets, address[] calldata _feeds) external onlyGov {
        for(uint256 i = 0; i<_assets.length; i++) {
            feed[_assets[i]] = AggregatorV3Interface(_feeds[i]);
        }
    }

    function support(address _asset) external view override returns (bool) {
        return address(feed[_asset]) != address(0);
    }

    function getPrice(address _asset)
        public
        view
        override
        returns (float memory)
    {
        (, int256 price, , , ) = feed[_asset].latestRoundData();
        uint256 decimalSum = feed[_asset].decimals() +
            IERC20Metadata(_asset).decimals();
        if (decimalSum > 18) {
            return
                float({
                    numerator: uint256(price),
                    denominator: 10**(decimalSum - 18)
                });
        } else {
            return
                float({
                    numerator: uint256(price) * 10**(18 - decimalSum),
                    denominator: 1
                });
        }
    }

    function getLiquidity(address _asset)
        external
        view
        override
        returns (uint256)
    {
        revert("chainlink adapter does not support liquidity");
    }
}
