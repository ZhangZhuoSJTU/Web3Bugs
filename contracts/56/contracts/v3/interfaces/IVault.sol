// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";

interface IVault {
    function available() external view returns (uint256);
    function balance() external view returns (uint256);
    function deposit(uint256 _amount) external returns (uint256);
    function earn(address _strategy) external;
    function gauge() external returns (address);
    function getLPToken() external view returns (address);
    function getPricePerFullShare() external view returns (uint256);
    function getToken() external view returns (address);
    function manager() external view returns (IManager);
    function withdraw(uint256 _amount) external;
    function withdrawAll() external;
    function withdrawFee(uint256 _amount) external view returns (uint256);
}
