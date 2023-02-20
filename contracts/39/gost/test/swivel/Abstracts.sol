// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

abstract contract Erc20 {
	function approve(address, uint256) virtual external returns (bool);
	function transfer(address, uint256) virtual external returns (bool);
	function balanceOf(address) virtual external returns (uint256);
	function transferFrom(address, address, uint256) virtual public returns (bool);
}

abstract contract CErc20 is Erc20 {
	function mint(uint256) virtual external returns (uint256);
	function redeem(uint256) virtual external returns (uint256);
	function redeemUnderlying(uint256) virtual external returns (uint256);
	function exchangeRateCurrent() virtual external returns (uint256);
}

abstract contract MarketPlace {
  // adds notional and mints zctokens
  function mintZcTokenAddingNotional(address, uint256, address, uint256) virtual external returns (bool);
  // removes notional and burns zctokens
  function burnZcTokenRemovingNotional(address, uint256, address, uint256) virtual external returns (bool);
  // returns the amount of underlying principal to send
  function redeemZcToken(address, uint256, address, uint256) virtual external returns (uint256);
  // returns the amount of underlying interest to send
  function redeemVaultInterest(address, uint256, address) virtual external returns (uint256);
  // returns the cToken address for a given market
  function cTokenAddress(address, uint256) virtual external returns (address);
  // EVFZE FF EZFVE call this which would then burn zctoken and remove notional
  function custodialExit(address, uint256, address, address, uint256) virtual external returns (bool);
  // IVFZI && IZFVI call this which would then mint zctoken and add notional
  function custodialInitiate(address, uint256, address, address, uint256) virtual external returns (bool);
  // IZFZE && EZFZI call this, tranferring zctoken from one party to another
  function p2pZcTokenExchange(address, uint256, address, address, uint256) virtual external returns (bool);
  // IVFVE && EVFVI call this, removing notional from one party and adding to the other
  function p2pVaultExchange(address, uint256, address, address, uint256) virtual external returns (bool);
  // IVFZI && IVFVE call this which then transfers notional from msg.sender (taker) to swivel
  function transferVaultNotionalFee(address, uint256, address, uint256) virtual external returns (bool);
}
