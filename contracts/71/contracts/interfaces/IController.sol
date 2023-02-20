pragma solidity 0.8.7;

interface IController {
    function withdraw(address, uint256) external;

    function valueAll() external view returns (uint256);

    function earn(address, uint256) external;

    function migrate(address) external;
}
