// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IBurn {
    struct RemoveLiquidity {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetTo;
        address collateralTo;
        uint256 liquidityIn;
    }

    struct RemoveLiquidityETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address payable assetTo;
        address collateralTo;
        uint256 liquidityIn;
    }

    struct RemoveLiquidityETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address assetTo;
        address payable collateralTo;
        uint256 liquidityIn;
    }
}
