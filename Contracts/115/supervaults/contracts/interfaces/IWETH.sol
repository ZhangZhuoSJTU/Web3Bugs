pragma solidity 0.8.10;

interface IWETH {
  function balanceOf(address user) external view returns (uint256);

  function deposit() external payable;

  function transfer(address to, uint256 value) external returns (bool);

  function approve(address to, uint256 value) external returns (bool);

  function withdraw(uint256) external;

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
