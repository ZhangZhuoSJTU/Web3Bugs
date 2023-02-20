// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

interface IWithdraw {
    struct Collect {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetTo;
        address collateralTo;
        IPair.Claims claimsIn;
    }

    struct CollectETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address payable assetTo;
        address collateralTo;
        IPair.Claims claimsIn;
    }

    struct CollectETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address assetTo;
        address payable collateralTo;
        IPair.Claims claimsIn;
    }

    struct _Collect {
        IFactory factory;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetTo;
        address collateralTo;
        IPair.Claims claimsIn;
    }
}
