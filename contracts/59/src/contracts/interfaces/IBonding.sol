pragma solidity >=0.6.6;

interface IBonding {
  function bond(uint256 amount) external;
  function bondToAccount(address account, uint256 amount) external;
  function unbond(uint256 amount) external;
  function totalBonded() external view returns (uint256);
  function balanceOfBonded(address account) external view returns (uint256);
  function averageBondedValue(uint256 epoch) external view returns (uint256);
}
