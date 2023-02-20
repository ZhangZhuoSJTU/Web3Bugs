// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/ICSSRAdapter.sol";

contract MockAdapter is ICSSRAdapter {

    mapping(address => uint256) public numerator;
    
    function setPrice(address _asset, uint256 _newPrice) external {
        numerator[_asset] = _newPrice;
    }

    function update(address _asset, bytes memory _data) external override returns(float memory price) {
        price = getPrice(_asset);
    }

    function support(address _asset) external override view returns(bool) {
        return true;
    }

    function getPrice(address _asset) public override view returns(float memory price) {
        if(numerator[_asset] == 0) {
            return float({numerator:1e18, denominator: 1e18});
        } else {
            return float({numerator:numerator[_asset], denominator: 1e18});
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
