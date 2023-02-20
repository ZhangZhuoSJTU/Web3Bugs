// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

struct StrategyParams {
    uint256 performanceFee;
    uint256 activation;
    uint256 debtRatio;
    uint256 minDebtPerHarvest;
    uint256 maxDebtPerHarvest;
    uint256 lastReport;
    uint256 totalDebt;
    uint256 totalGain;
    uint256 totalLoss;
}

interface IYearnV2Vault {
    function strategies(address _strategy) external view returns (StrategyParams memory);

    function totalAssets() external view returns (uint256);

    function pricePerShare() external view returns (uint256);

    function deposit(uint256 _amount, address _recipient) external;

    function withdraw(
        uint256 maxShares,
        address recipient,
        uint256 maxLoss
    )
        external
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        );

    function withdrawByStrategy(
        address[20] calldata _strategies,
        uint256 maxShares,
        address recipient,
        uint256 maxLoss
    ) external returns (uint256);

    function depositLimit() external view returns (uint256);

    function debtOutstanding(address strategy) external view returns (uint256);

    function totalDebt() external view returns (uint256);

    function updateStrategyDebtRatio(address strategy, uint256 ratio) external;

    function withdrawalQueue(uint256 index) external view returns (address);

    function report(
        uint256 _gain,
        uint256 _loss,
        uint256 _debtPayment
    ) external returns (uint256);
}
