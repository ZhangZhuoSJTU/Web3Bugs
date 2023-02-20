// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface ILendingPair {

  function tokenA() external view returns(address);
  function tokenB() external view returns(address);
  function lpToken(address _token) external view returns(address);
  function deposit(address _account, address _token, uint _amount) external;
  function withdraw(address _token, uint _amount) external;
  function withdrawAll(address _token) external;
  function transferLp(address _token, address _from, address _to, uint _amount) external;
  function supplySharesOf(address _token, address _account) external view returns(uint);
  function totalSupplyShares(address _token) external view returns(uint);
  function supplyOf(address _token, address _account) external view returns(uint);

  function supplyBalanceConverted(
    address _account,
    address _suppliedToken,
    address _returnToken
  ) external view returns(uint);
}