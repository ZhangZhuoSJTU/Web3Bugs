// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";

interface IVault {
    function available(address _token) external view returns (uint256);
    function balance() external view returns (uint256);
    function deposit(address _token, uint256 _amount) external returns (uint256);
    function depositMultiple(address[] calldata _tokens, uint256[] calldata _amount) external returns (uint256);
    function earn(address _token, address _strategy) external;
    function gauge() external returns (address);
    function getPricePerFullShare() external view returns (uint256);
    function getTokens() external view returns (address[] memory);
    function manager() external view returns (IManager);
    function swap(address _token0, address _token1, uint256 _expectedAmount) external returns (uint256);
    function withdraw(uint256 _amount, address _output) external;
    function withdrawAll(address _output) external;
    function withdrawFee(uint256 _amount) external view returns (uint256);
}
