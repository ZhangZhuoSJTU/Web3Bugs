// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./IOverlayToken.sol";
import "./IOverlayTokenNew.sol";

interface IOverlayV1Mothership {

    function ovl () external view returns (
        IOverlayTokenNew ovl_
    );

    function marketActive(
        address
    ) external view returns (
        bool
    );

    function marketExists(
        address
    ) external view returns (
        bool
    );

    function allMarkets(
        uint marketIndex
    ) external view returns (
        address marketAddress
    );

    function collateralActive(
        address
    ) external view returns (
        bool
    );

    function collateralExists(
        address
    ) external view returns (
        bool
    );

    function allCollateral(
        uint collateralIndex
    ) external view returns (
        address collateralAddress
    );

    function totalMarkets () external view returns (
            uint
    );

    function getGlobalParams() external view returns (
        uint16 fee_,
        uint16 feeBurnRate_,
        address feeTo_,
        uint8 marginMaintenance_,
        uint8 marginBurnRate_
    );

    function getUpdateParams() external view returns (
        uint marginBurnRate_,
        uint feeBurnRate_,
        address feeTo_
    );

    function getMarginParams() external view returns (
        uint marginMaintenance_,
        uint marginRewardRate_
    );

    function fee() external view returns (uint256);

    function updateMarket(
        address _market,
        address _rewardsTo
    ) external;

    function massUpdateMarkets(
        address _rewardsTo
    ) external;

    function hasRole(
        bytes32 _role,
        address _account
    ) external view returns (
        bool
    );

}
