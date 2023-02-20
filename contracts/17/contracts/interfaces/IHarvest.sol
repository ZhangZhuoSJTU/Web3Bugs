// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

interface IHarvest {
    function deposit(uint256 amount) external;

    function balanceOf(address account) external view returns (uint256);

    function getPricePerFullShare() external view returns (uint256);

    function transfer(address recipient, uint256 amount) external;

    function withdraw(uint256 numberOfShares) external;

    function withdrawAll() external;

    function approve(address spender, uint256 amount) external;

    function underlying() external view returns (address);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint256);
}

interface IStake {
    function balanceOf(address account) external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function lpToken() external view returns (address);

    function stake(uint256 amount) external;

    function getReward() external;

    function withdraw(uint256 amount) external;

    function exit() external;
}
