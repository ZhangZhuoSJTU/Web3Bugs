// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import {IPangolinRouter} from "@pangolindex/exchange-contracts/contracts/pangolin-periphery/interfaces/IPangolinRouter.sol";
import "./IExperiPie.sol";

interface IPangolinRebalanceManager {
    struct SwapStruct {
        address from; //Token to sell
        address to; //Token to buy
        uint256 quantity; //Quantity to sell
        uint256 minReturn; //Minimum quantity to buy //todo change to price for safty
    }

    /**
        @notice Rebalance underling token
        @param _swaps Swaps to perform
        @param _deadline Unix timestamp after which the transaction will revert.
    */
    function rebalance(SwapStruct[] calldata _swaps, uint256 _deadline)
        external;
}
