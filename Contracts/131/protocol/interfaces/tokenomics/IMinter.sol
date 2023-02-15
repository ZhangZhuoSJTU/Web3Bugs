// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IMinter {
    function setToken(address _token) external;

    function startInflation() external;

    function executeInflationRateUpdate() external returns (bool);

    function mint(address beneficiary, uint256 amount) external returns (bool);

    function mintNonInflationTokens(address beneficiary, uint256 amount) external returns (bool);

    function getLpInflationRate() external view returns (uint256);

    function getKeeperInflationRate() external view returns (uint256);

    function getAmmInflationRate() external view returns (uint256);
}
