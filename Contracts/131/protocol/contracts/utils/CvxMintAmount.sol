// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libraries/UncheckedMath.sol";

abstract contract CvxMintAmount {
    using UncheckedMath for uint256;

    uint256 private constant _CLIFF_SIZE = 100000 * 1e18; //new cliff every 100,000 tokens
    uint256 private constant _CLIFF_COUNT = 1000; // 1,000 cliffs
    uint256 private constant _MAX_SUPPLY = 100000000 * 1e18; //100 mil max supply
    IERC20 private constant _CVX_TOKEN =
        IERC20(address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B)); // CVX Token

    function getCvxMintAmount(uint256 crvEarned) public view returns (uint256) {
        //first get total supply
        uint256 cvxTotalSupply = _CVX_TOKEN.totalSupply();

        //get current cliff
        uint256 currentCliff = cvxTotalSupply / _CLIFF_SIZE;

        //if current cliff is under the max
        if (currentCliff >= _CLIFF_COUNT) return 0;

        //get remaining cliffs
        uint256 remaining = _CLIFF_COUNT.uncheckedSub(currentCliff);

        //multiply ratio of remaining cliffs to total cliffs against amount CRV received
        uint256 cvxEarned = (crvEarned * remaining) / _CLIFF_COUNT;

        //double check we have not gone over the max supply
        uint256 amountTillMax = _MAX_SUPPLY - cvxTotalSupply;
        if (cvxEarned > amountTillMax) cvxEarned = amountTillMax;
        return cvxEarned;
    }
}
