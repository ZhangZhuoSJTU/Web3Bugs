// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@mochifi/library/contracts/Float.sol";

enum AssetClass {
    Invalid,
    Stable,
    Alpha,
    Gamma,
    Delta,
    Zeta,
    Sigma,
    Revoked
}

interface IMochiProfile {
    function assetClass(address _asset) external view returns (AssetClass);

    function liquidityRequirement() external view returns (uint256);

    function minimumDebt() external view returns (uint256);

    function changeAssetClass(
        address[] calldata _asset,
        AssetClass[] calldata _class
    ) external;

    function changeLiquidityRequirement(uint256 _requirement) external;

    function changeMinimumDebt(uint256 _debt) external;

    function calculateFeeIndex(
        address _asset,
        uint256 _currentIndex,
        uint256 _lastAccrued
    ) external view returns (uint256);

    function creditCap(address _asset) external view returns (uint256);

    function delay() external view returns (uint256);

    function liquidationFactor(address _asset)
        external
        view
        returns (float memory);

    function maxCollateralFactor(address _asset)
        external
        view
        returns (float memory);

    function stabilityFee(address _asset) external view returns (float memory);

    function liquidationFee(address _asset)
        external
        view
        returns (float memory);

    function keeperFee(address _asset) external view returns (float memory);

    function utilizationRatio(address _asset)
        external
        view
        returns (float memory);
}
