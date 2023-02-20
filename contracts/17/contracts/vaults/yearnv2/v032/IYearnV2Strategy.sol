// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IYearnV2Strategy {
    function vault() external view returns (address);

    function setVault(address _vault) external;

    function keeper() external view returns (address);

    function setKeeper(address _keeper) external;

    function harvestTrigger(uint256 callCost) external view returns (bool);

    function harvest() external;

    function withdraw(uint256 _amount) external;

    function estimatedTotalAssets() external view returns (uint256);
}
