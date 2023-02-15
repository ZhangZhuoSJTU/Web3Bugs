// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.10;

import "./IOracle.sol";
import "../product/types/position/Position.sol";
import "../utils/types/UFixed18.sol";
import "../utils/types/Fixed18.sol";

interface IProductProvider is IOracle {
    function rate(Position memory position) external view returns (Fixed18);
    function payoff(Fixed18 price) external view returns (Fixed18);
    function maintenance() external view returns (UFixed18);
    function fundingFee() external view returns (UFixed18);
    function makerFee() external view returns (UFixed18);
    function takerFee() external view returns (UFixed18);
    function makerLimit() external view returns (UFixed18);
}
